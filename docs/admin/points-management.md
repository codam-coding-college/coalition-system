# Points Management

The points management section of the admin interface provides tools for viewing, assigning, and adjusting `CodamCoalitionScore` records. "CRUD" in this context means Create, Read, Update, Delete — the standard set of data operations.

## Point History

**Route:** `GET /admin/points/history`

Browse all coalition scores with pagination. The history can be filtered by:

| Filter | Route |
|--------|-------|
| By user login | `GET /admin/points/history/login/:login` |
| By fixed type | `GET /admin/points/history/type/:fixedTypeId` |
| By Intra object ID | `GET /admin/points/history/intra_type_id/:intraTypeId` |
| By date | `GET /admin/points/history/date/:date` |
| By coalition | `GET /admin/points/history/coalition/:coalitionName` |
| By reason (partial match) | `GET /admin/points/history/reason/:partialReason` |
| Single score detail | `GET /admin/points/history/:id` |

## Per-Score Operations

Each individual score entry has three operations available:

| Operation | Route | Description |
|-----------|-------|-------------|
| Sync to Intra | `GET /admin/points/history/:id/sync` | Re-syncs this score to Intra (creates or updates the Intra Score object) |
| Recalculate | `GET /admin/points/history/:id/recalculate` | Recalculates the score amount using the current formula and fixed type settings |
| Delete | `GET /admin/points/history/:id/delete` | Permanently removes the score record |

## Manual Point Assignment

### Custom Points

**Route:** `POST /admin/points/manual/custom`

Award a custom number of points to student(s) with a specified reason. This creates a `CodamCoalitionScore` with `fixed_type_id = null` (i.e. a custom, non-fixed score). Scores can be awarded through a form (for a single user) or via CSV upload (for multiple users).

### Event Points

**Route:** `POST /admin/points/manual/event`

Award points for organizing a campus event. The admin selects the [event tier](../features/scoring.md#events) (basic, intermediate, advanced), and the corresponding fixed point type amount is awarded.

## Automatic Point Types

**Route:** `GET /admin/points/automatic`

Lists all `CodamCoalitionFixedType` records with their current point amounts and descriptions. Allows for editing each fixed type's options.

**Route:** `POST /admin/points/automatic/:type/edit`

Update the `point_amount` for a fixed type. This affects all future score calculations using that type but does not retroactively change existing scores.

See [features/scoring.md](../features/scoring.md) for the full list of fixed types and how they are used in formulas.

## Shift Tool

**Route:** `GET /admin/points/shift`

Assign scores awarded between two seasons to a season of choice by changing their `created_at` date. This is useful for assigning scores to the correct season after a new season starts, since scores are initially created with the date they were awarded, which may be before the new season's start date.

The shift operation updates each score's `created_at` and re-syncs it to Intra. This is a permanent, irreversible operation that changes the history of scores, so it should be used with caution.
