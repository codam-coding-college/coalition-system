# Admin Interface

## Access Control

The admin interface is accessible to users whose Intra account has `kind === 'admin'` (i.e., Intra staff members). This is checked by `isStaff()` in `src/utils.ts`, which simply checks `intraUser.kind === 'admin'`.

The `staffMiddleware` in `src/handlers/middleware.ts` applies this check to all routes matching `/admin/*`. Non-staff users receive HTTP 403.

`INTRA_ASSISTANT_GROUP_ID` (identifying the Codam Assistant Team) does **not** grant admin access.

## Admin Routes

| Route | Description |
|-------|-------------|
| `GET /admin` or `GET /admin/dashboard` | Admin dashboard: system health overview |
| `GET /admin/points/history` | Browse all coalition scores with filtering options |
| `GET /admin/points/automatic` | View and edit fixed point type amounts |
| `GET /admin/points/manual/*` | Manual point assignment forms |
| `GET /admin/points/shift` | Shift non-season-allocated scores to a season of choice |
| `GET /admin/quiz` | Manage quiz questions and answers |
| `GET /admin/rankings` | List cross-coalition rankings |
| `GET /admin/rankings/:type/edit` | Edit a specific ranking |
| `GET /admin/titles` | List coalition titles |
| `GET /admin/titles/:id/edit` | Edit a specific title |
| `GET /admin/coalitions` | View and edit coalition metadata (tagline, description) |
| `GET /admin/users` | Search for users by login |
| `GET /admin/charts` | Admin analytics charts, not used by users directly |
| `GET /admin/hooks/history` | Webhook delivery log |
| `GET /admin/hooks/secrets` | Webhook secret management |
| `GET /admin/hooks/catchup` | Webhook catchup tool for missed events |
| `GET /admin/apisearcher` | Intra API search tool for manual point awarding, not used by users directly |

## Admin Dashboard

The dashboard at `/admin/dashboard` provides a high-level overview of the system's current state, including:
- Whether a season is currently active
- Score statistics
- Sync status and last sync timestamp

## Nunjucks Templates

Admin templates are located in `templates/admin/`. Each admin route renders a template from this directory. The base layout `templates/base.njk` is shared with the student-facing interface.
