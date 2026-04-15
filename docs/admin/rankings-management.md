# Rankings Management

The rankings admin section allows staff to create, read, update, and delete (CRUD) cross-coalition ranking definitions.

## What Is a Ranking?

A ranking is a leaderboard that measures a specific type of student achievement across all coalitions. For example, a ranking might measure who has done the most evaluations or earned the most project points. Rankings are defined by `CodamCoalitionRanking` records.

See [features/rankings.md](../features/rankings.md) for how ranking scores are computed and how bonus points work.

## Fields

| Field | Description |
|-------|-------------|
| `type` | Unique identifier key (e.g. `"guiding_stars"`). Cannot be changed after creation. |
| `name` | Display name shown in the UI (e.g. `"Guiding Stars"`) |
| `description` | Explanation of what this ranking measures |
| `top_title` | The title text for the #1 ranked user (used to create an Intra title at season end) |
| `top_title_intra_id` | The Intra Title ID for the #1 title. Must be set manually after creating the title on Intra. |
| `bonus_points` | Total bonus points to distribute during the final 7 days of a season (divided across 168 hourly intervals) |
| `disabled` | If checked, this ranking is excluded from all calculations and no bonuses are awarded |

## Linking Fixed Types to Rankings

Rankings aggregate scores from fixed types that share the same `ranking_type` value. This link is configured on each `CodamCoalitionFixedType` (editable in the automatic point types section of points management).

To include a fixed type in a ranking, set its `ranking_type` field to the ranking's `type` key. Multiple fixed types can contribute to the same ranking.

## Creating a New Ranking

1. Fill in `name`, `title of #1` and `description`. The title gets automatically created on Intra upon ranking creation.
2. Set `bonus_points` (or leave 0 to disable bonuses for this ranking)
3. Configure which fixed types contribute to it by editing their `ranking_type` field

## Disabling a Ranking

Setting `disabled = true` stops all calculations for that ranking. No bonus points will be awarded, and it will not appear in the public rankings view. Existing `CodamCoalitionRankingResult` records for past seasons are preserved.

## Routes

| Route | Description |
|-------|-------------|
| `GET /admin/rankings` | Manage and create rankings |
| `GET/POST /admin/rankings/:type/edit` | Edit an existing ranking |
| `POST /admin/rankings/:type/delete` | Delete a ranking |
