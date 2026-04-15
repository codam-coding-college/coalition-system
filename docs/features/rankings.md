# Rankings

## Overview

In addition to the coalition team competition, the system tracks individual cross-coalition rankings. A ranking measures a specific type of achievement across all coalitions — for example, who has done the most evaluations regardless of which coalition they belong to.

Each ranking is defined by a `CodamCoalitionRanking` record. Rankings are displayed at `/rankings`.

## How Ranking Scores Are Computed

A student's score in a ranking is the sum of all `CodamCoalitionScore` records where:
- The score's `fixed_type.ranking_type` matches any of a ranking's `type`s

This means ranking scores are derived directly from the existing scoring data — no separate score records are created. Changing which fixed types feed a ranking (via `CodamCoalitionFixedType.ranking_type`) changes the ranking retroactively.

Example: If the `evaluation` fixed type has `ranking_type = "guiding_stars"`, then all evaluation points accumulate toward the "Guiding Stars" ranking.

## Season-End Snapshots

At the end of each season, the final rankings are snapshotted into `CodamCoalitionRankingResult` records. These preserve the historical standings without being affected by later score changes.

## Bonus Points

During the **last 7 days of a season**, the system awards bonus points hourly to the user(s) holding the #1 spot in each ranking if bonus points are configured for that ranking. This is intended to intensify competition in the final stretch.

The total bonus points per ranking are configured in `CodamCoalitionRanking.bonus_points`. These are divided across 168 hourly intervals (7 days × 24 hours). Each hour, the amount `bonus_points / 168` is awarded to the current #1.

If multiple users are tied for #1, the bonus points for that hour are split evenly among them. For example, if 3 users are tied for #1 and the hourly bonus is 15 points, each user would receive 5 points.

The hourly bonus runs are triggered during the periodic sync. `CodamCoalitionRanking.last_bonus_run` tracks when the last run occurred to prevent double-awarding within the same hour.

Bonus point scores use the `ranking_bonus` fixed type.

## Ranking Titles

At season end, the #1 user in each ranking receives a title on Intra. The title is defined by `CodamCoalitionRanking.top_title` and created on Intra (stored as `top_title_intra_id` once created). See [titles.md](titles.md) for more on how titles work.
