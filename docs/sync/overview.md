# Intra Synchronization Overview

## Sync Triggers

The system synchronizes with the Intra API in two ways:

1. **Startup sync** — runs once immediately when the application starts (unless `--nosync` is passed)
2. **Periodic sync** — runs every 10 minutes via `setInterval` after the startup sync completes

Both use the same `syncWithIntra()` function in `src/sync/base.ts`.

## Sync Timestamp

The file `.sync-timestamp` in the project root stores the Unix timestamp (milliseconds) of the last successful sync completion.

On each sync run, the system reads this file to determine `lastSyncDate`. Intra API requests use a `range[updated_at]` filter to fetch only records updated since that date. This makes subsequent syncs much faster than fetching all data every time.

After a successful sync, the timestamp is updated to the time the sync started (not ended), so no updates are missed in the window between the sync start and any network delays.

If `.sync-timestamp` is missing or unreadable, `lastSyncDate` defaults to the Unix epoch (0), which causes a full resync of all historical data.

**Forcing a full resync:** Delete `.sync-timestamp` and restart the application.

## Sync Steps (in order)

Each sync run executes the following steps in sequence:

```
1. initCodamQuiz()
   └─ Creates quiz questions/answers on first run if the database is empty

2. initCodamCoalitionFixedTypes()
   └─ Ensures all default fixed point types exist in the database

3. syncScores() [production only, when an active bloc exists]
   └─ Pushes local CodamCoalitionScore records to Intra's coalition score system

4. syncProjects()
   └─ Fetches IntraProject records (name, slug, difficulty, exam flag)

5. syncUsers()
   └─ Fetches IntraUser records for the campus

6. syncCursusUsers()
   └─ Fetches IntraCursusUser enrollments for the configured cursus

7. syncGroups()
   └─ Fetches data on the [configured Assistants group](../configuration.md)

8. syncGroupsUsers()
   └─ Fetches [configured Assistants group](../configuration.md) memberships (always full fetch, not incremental, due to group membership revocations)

9. syncBlocs()
   └─ Fetches IntraBloc, IntraBlocDeadline, and IntraCoalition records

10. syncCoalitionUsers()
    └─ Fetches IntraCoalitionUser membership links

11. handleRankingTitleCreation()
    └─ Creates Intra Title objects for any CodamCoalitionRanking that
       has a top_title but no top_title_intra_id yet

12. handleRankingBonuses()
    └─ If in the last 7 days of a season and at least 1 hour has passed
       since last_bonus_run: awards bonus_points / 168 to the current
       #1 holder(s) in each ranking

13. syncTitles()
    └─ Updates Intra title holders based on current coalition rankings

14. calculateResults()
    └─ Snapshots results for any finished seasons that have no snapshot yet

15. cleanupDB()
    └─ Removes IntraUser and IntraGroupUser records no longer present on Intra

16. saveSyncTimestamp()
    └─ Writes the current timestamp to .sync-timestamp
```

If any step throws an unhandled error, the sync logs the failure and stops. The timestamp is **not** updated on failure, so the next sync retries from the last successful point.

## Why We Snapshot Results

Season results (`CodamCoalitionSeasonResult`, `CodamCoalitionUserResult`, `CodamCoalitionRankingResult`) are written once per season and never updated. This is intentional.

After a season ends, scores may still be (mistakenly) corrected, recalculated, or manually adjusted by admins. If the results were computed dynamically from live score data, those corrections would alter the historical record. The snapshot ensures the results reflect the state at the exact moment the season ended — which is what matters for the final standings.

The snapshot is created by `calculateResults()` in `src/sync/results.ts`, which only runs for seasons that have `end_at < now` and have a winner set on Intra (`coalition_id != null`) but have no existing result record.

## DEV_DAYS_LIMIT

In development mode, the sync applies a time cutoff to avoid pulling years of historical data. The cutoff is `now - DEV_DAYS_LIMIT days` (default 365). This applies to all endpoints except `/users`, which always fetches all campus users.

Set via shell: `DEV_DAYS_LIMIT=30 npm start`

## Fast42 Wrapper Functions

The system uses `@codam/fast42` as its Intra API client. Fast42 handles OAuth2 token refresh, rate limiting (to some extent) and low-level HTTP. Three wrapper functions in `src/sync/base.ts` fill some gaps left by Fast42:

### `fetchMultiple42ApiPages(api, path, params)`

Fetches all paginated pages in parallel and returns a flat array of all items. Handles HTTP 429 (rate limit) responses by reading the `Retry-After` header and retrying after the specified delay plus a small random jitter.

Use this when you need all records in memory at once.

### `fetchMultiple42ApiPagesCallback(api, path, params, callback)`

Fetches pages sequentially and calls `callback(data, xPage, xTotal)` for each page as it arrives. Also handles 429 rate limiting.

Use this for large datasets where loading everything into memory at once would be problematic, or when you need the `X-Page` / `X-Total` headers for progress tracking (as used in the catchup tool).

### `fetchSingle42ApiPage(api, path, params)`

Fetches a single endpoint and returns the JSON response. Handles 429 rate limiting with the same retry logic.

All three wrappers add a random jitter (up to 1 second) to the retry delay to avoid thundering-herd behavior when multiple pages are rate-limited simultaneously.
