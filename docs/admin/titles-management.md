# Titles Management

The titles admin section allows staff to create, read, update, and delete (CRUD) coalition title definitions. Titles are rank-based achievements visible on students' Intra profiles.

See [features/titles.md](../features/titles.md) for an overview of how titles work.

## Fields

| Field | Description |
|-------|-------------|
| `title` | The title text as it will appear on Intra (must be unique across all titles) |
| `coalition_id` | Which coalition this title belongs to |
| `ranking` | The rank position within the coalition (1 = top of the coalition leaderboard) |
| `intra_title_id` | The Intra Title object ID. Must be set for the sync to grant the title to users. |

The combination of `coalition_id` and `ranking` must be unique — each rank within a coalition can have exactly one title.

## Creating a Title

Creating a title is easy. In the admin interface at `/admin/titles`, create a new title record. Upon creation the title gets automatically created on Intra and the `intra_title_id` field is populated. If the title already exists on Intra, you will have to manually create the title locally using a [development utility script](../development.md#dev-utility-scripts).

## Syncing Titles

The title sync runs automatically during each periodic sync. It evaluates who currently holds the top position(s) within each coalition and updates the `CodamCoalitionTitleUser` records and the corresponding Intra `TitlesUsers` objects accordingly.

The **"Force resync all titles"** button on the admin titles page triggers a re-evaluation of all titles during the next periodic sync. This is useful after making changes to title definitions or after correcting scores that might affect rankings.

## Routes

| Route | Description |
|-------|-------------|
| `GET /admin/titles` | List all titles with current holders and sync status |
| `GET/POST /admin/titles/create` | Form to create a new title |
| `GET/POST /admin/titles/:id/edit` | Edit an existing title |
| `POST /admin/titles/:id/delete` | Delete a title (also revokes it from any current holders on Intra) |
| `POST /admin/titles/resync` | Force resync all title holders |
