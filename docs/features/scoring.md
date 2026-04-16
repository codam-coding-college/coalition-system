# Scoring

## Overview

Points are awarded to students as `CodamCoalitionScore` records. Every score belongs to a student, a coalition, and a time (used to assign it to a season). Scores accumulate to form a student's personal total and their coalition's competitive score.

The point system has two categories: **fixed-type scores** (awarded automatically by webhooks with predefined formulas) and **custom scores** (assigned manually by staff/admins).

## Fixed Point Types

Fixed types are named categories defined in `CodamCoalitionFixedType`. They are initialized on startup by `src/sync/fixed_point_types.ts` and can have their `point_amount` edited in the admin interface.

| Type | Default amount | Formula / usage |
|------|---------------|-----------------|
| `project` | 7 | Factor in the project completion formula (see below) |
| `evaluation` | 40 | Points per 15-minute block of evaluation given |
| `point_donated` | 120 | Points per eval point donated to the correction pool |
| `logtime` | 10 | Points per hour of campus computer usage |
| `idle_logout` | −10 | Penalty per automatic idle logout from a campus computer (negative value) |
| `exam` | 1000 | Factor in the exam score formula (see below) |
| `event_basic` | 1000 | Flat award for organizing a basic event |
| `event_intermediate` | 3000 | Flat award for organizing an intermediate event |
| `event_advanced` | 6000 | Flat award for organizing an advanced event |
| `ranking_bonus` | 0 | Not used in a formula; actual amounts come from ranking settings |

## Point Formulas

### Projects

Triggered when a `projects_users` webhook fires with `status = "finished"` and `validated? = true`.

```
points = floor( (mark × factor) + (difficulty × (mark / 100) / factor^1.25) )
```

Where:
- `mark` = the final mark (0–100)
- `factor` = `point_amount` of the `project` fixed type (default 7)
- `difficulty` = `IntraProject.difficulty`

Projects with `difficulty = 0` or `null` are skipped (no points awarded).

> Rush projects (`slug` starts with `rushes-` or `42cursus-rushes-`) that have no difficulty set are assigned a default difficulty of 1000.

### Exams

Also triggered by `projects_users` webhooks, but for projects flagged as exams (`IntraProject.exam = true`).

```
points = floor( (mark / 100) × fixed_point_amount )
```

Where:
- `mark` = the final exam mark (0–100)
- `fixed_point_amount` = `point_amount` of the `exam` fixed type (default 1000)

A perfect score (100%) awards the full `point_amount`. A 50% score awards half, etc.

### Evaluations

Triggered when a `scale_teams` webhook fires with `filled_at` set (evaluation completed). Points go to the **corrector** (the person who did the evaluating), not the person being evaluated.

```
points = point_amount × duration_blocks × sale_multiplier
```

Where:
- `point_amount` = `point_amount` of the `evaluation` fixed type (default 40)
- `duration_blocks` = duration of the evaluation in 15-minute blocks
  - From webhooks: already in 15-minute blocks
  - From the API: in seconds, divided by 900
- `sale_multiplier` = `2` if an evaluation points sale (`IntraBalance`) was active at the time the evaluation was filled in, otherwise `1`

Supervisor evaluations (from internship company supervisors) and evaluations by users not in the local database are skipped.

#### Evaluation Points Sales

When an evaluation points sale is active on Intra (tracked as `IntraBalance` records, synced by `syncEvalPointSales()`), the coalition points granted for completing an evaluation are doubled. A sale is considered active at the time of `filled_at` if a matching `IntraBalance` record has `begin_at ≤ filled_at` and either `end_at` is null or `end_at > filled_at`. The score reason will include `"during an evaluation points sale (double points)"` to make the multiplier visible in the audit trail.

### Point Donations

Triggered when a `pools:point_given` webhook fires (a student donates eval points to the correction pool).

```
points = points_donated × point_amount
```

Where:
- `points_donated` = the number of eval points donated (`current - old`)
- `point_amount` = `point_amount` of the `point_donated` fixed type (default 120)

Note: Pool donations **cannot** be caught up retroactively using the [catchup tool](../admin/hooks-management.md#catchup-tool) (no Intra API endpoint exists to support this).

### Logtime

Triggered when a `locations:close` webhook fires (a student logs out of a campus computer).

```
points = floor( duration_hours × point_amount )
```

Where:
- `duration_hours` = (`end_at - begin_at`) in hours
- `point_amount` = `point_amount` of the `logtime` fixed type (default 10)

### Idle Logout Penalty

Triggered by a custom internal webhook at `/hooks/idlelogout`. This is **not** a standard Intra webhook — it must be implemented in the campus cluster computers, which call this endpoint when an automatic logout after idling occurs.

```
points = point_amount   (typically negative, e.g. -10)
```

The purpose is to discourage students from remaining logged in to computers while away, since idle time would otherwise accumulate as logtime points.

### Events

Awarded manually by admins via the admin interface. Flat amounts based on event tier.

#### Event tiers

These are the guidelines for the different tiers of events, including recommended criteria.

##### Basic event
A basic event is suitable for small gatherings of students, it's simple to organize, held within the campus building with minimal logistic requirements , no budget involved. Example: "Movie Night".

###### Criteria for a basic event
- Aim for around 1-10 attendees.
- Minimal logistic arrangements needed, such as reserving the auditorium.
- Short event duration, typically lasting 1-2 hours including setup and cleanup.
- Does not require budgeting, as the resources needed (such as a movie, or campus facilities) are already freely available.

##### Intermediate event
An intermediate-level event aimed at engaging a larger number of students through activities that require moderate planning and coordination. Example: "Eastern Lunch" & "Table Tennis League".

###### Criteria for an intermediate event
- Aim for around 10-50 attendees.
- Moderate logistical arrangements, including securing a location (inside or outside of the campus), prepare and coordinate activities or themes for - the event.
- Limited budget requirement, covering food/drinks, possibility equipment and resources.
- Longer planning timeline with several deadlines.

##### Advanced event
An advanced-level event designed to bring together a large number of students for a significant social gathering or activity, requires extensive planning, resources and possibly external coordination. Example: "Student Party"

###### Criteria for an advanced event
- Aim for more than 50 attendees.
- Extensive planning with detailed scheduling and coordination, with several deadlines.
- Might involve coordination with external stakeholders, such as partners.
- High budget requirement, covering expenses for venue, catering, and entertainment etc...

### Ranking Bonuses

Awarded automatically during the last week of a season. See [rankings.md](rankings.md#bonus-points) for how bonus amounts are calculated and distributed.

## Score Creation: `createScore()`

`createScore()` in `src/handlers/points.ts` is the single entry point for all point awards. It performs the following validations before creating a record:

1. The user must exist in the database
2. The user must not be a staff member (`kind !== 'admin'`)
3. The user must not be listed in `INTRA_TEST_ACCOUNTS`
4. The user must have an active `IntraCursusUser` for `CURSUS_ID`
5. The score creation date must be within the current season's date range or there must be no season ongoing (in which case an admin can use the [point shifter](../admin/points-management.md#shift-tool) to assign it to the correct season later)
6. The user must have a coalition membership (`IntraCoalitionUser`)

On success, a `CodamCoalitionScore` is created. In production, the score is also synced to Intra asynchronously. After creation, the chart cache is invalidated.

## Idempotency: `handleFixedPointScore()`

`handleFixedPointScore()` wraps `createScore()` with idempotency logic using `type_intra_id` (the ID of the Intra object that triggered the score, e.g. `project_user.id`, `scale_team.id`, `location.id`).

When called with a `type_intra_id`:
1. It sums all existing scores for the same `(fixed_type_id, type_intra_id, user_id)` combination.
2. If the sum equals the new point amount (within ±10), the score is skipped.
3. If the sum differs by more than 10 points, the **difference** is awarded as a new score, even if it is negative.

This means webhook replays and retries are safe: only the incremental difference is awarded, not the full amount again.

## Score Sync to Intra

In production, when a score is created or updated, it is pushed to Intra's coalition score system via `src/handlers/intrascores.ts`. This keeps the Intra leaderboard in sync with the coalition system's calculations. This sync is skipped in development to prevent mixing local test data with production Intra data.
