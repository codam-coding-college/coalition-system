# Coalitions

## Domain Concepts

The coalition system is built around a hierarchy of time-bound competition:

```
IntraBloc (coalition setup on Intra)
    └── IntraBlocDeadline (season)
            └── IntraCoalition (team)
                    └── CodamCoalitionScore (individual point award)
```

**Bloc**: The coalition system on Intra, tying together coalitions and a cursus into a single competitive context.

**BlocDeadline (Season)**: A time period within a bloc, typically 3 months. It has a `begin_at` and `end_at`, and once it ends, Intra marks a `coalition_id` as the winner. In the code this is sometimes referred to as a "season", other times mistakenly as a "bloc".

**Coalition**: A team of students competing together. Each coalition has:
- A name, color, image (logo), and cover image sourced from Intra (`IntraCoalition`)
- An optional custom `tagline` and `description` managed locally (`CodamCoalition`)

**Score**: An individual point award to a student in a coalition. Scores are timestamped with `created_at`, which determines which season they belong to.

## Coalition Score Calculation

The coalition's competitive score shown in the leaderboard is **not** the sum of all individual scores. Instead, it is calculated as the **mean (average) score of all active contributors** for the current season.

"Active contributor" means a student who has earned at least one point in the current season. This approach prevents a coalition with many inactive members from being unfairly disadvantaged against a smaller, more active coalition.

This mean score is stored in `CodamCoalitionSeasonResult.score` at season end and used for the historical results view.

See the [scoring](scoring.md) documentation for how individual scores are computed and categorized.

## Season Results

When a season ends (its `end_at` has passed and Intra has set a winner coalition), the system snapshots the final standings into three models:

- `CodamCoalitionSeasonResult` — the coalition's final mean score for the season
- `CodamCoalitionUserResult` — each student's total points and rank within their coalition
- `CodamCoalitionRankingResult` — each student's position in each cross-coalition ranking

These snapshots are permanent. Future score corrections or additions do not retroactively alter past season results. See [sync/overview.md](../sync/overview.md) for when and why this is calculated.

## Visual Identity

Coalition colors, cover images, and logos are fetched from Intra and stored in `IntraCoalition`. The `CodamCoalition` record only stores the custom tagline and description. The Nunjucks templates and canvas renderer both use `intra_coalition.color`, `intra_coalition.cover_url`, and `intra_coalition.image_url`.
