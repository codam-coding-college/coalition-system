# Titles

## Overview

Titles are rank-based achievements within a coalition. The top-ranked students in each coalition receive a title (e.g. "Gold Star" for #1, "Silver Star" for #2). Titles are managed in this system but displayed exclusively on the 42 Intra website — they do not appear anywhere in the coalition system's own UI.

## Title Sync

The title sync (`src/sync/titles.ts`) runs during each periodic sync. It:

1. Reads the current rankings to determine who holds the top position within each coalition
2. Creates a `CodamCoalitionTitleUser` record if the user does not already hold that title
3. Checks if the user already holds a coalition title on Intra. If not, it creates a `TitlesUsers` object via the Intra API to grant the title on the student's Intra profile. If they already hold a title but it is different from the one they should have, it updates the existing `TitlesUsers` object to reflect the new title.
4. Revokes titles from students who are no longer in the top position

## Cross-Coalition Ranking Titles

In addition to coalition-internal titles, each cross-coalition ranking can award a title to the #1 ranked user at season end. This is configured via `CodamCoalitionRanking.top_title` and `top_title_intra_id`. See [rankings.md](rankings.md) for details.

## Admin Management

Titles can be created, edited, and deleted in the admin interface at `/admin/titles`. The "Force resync all titles" button re-runs the title sync immediately, which re-evaluates rankings and updates title holders on Intra.

See [admin/titles-management.md](../admin/titles-management.md).
