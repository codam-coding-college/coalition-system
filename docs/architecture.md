# Architecture

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | — |
| Language | TypeScript | ^5.9.3 |
| Web framework | Express.js | ^5.2.1 |
| ORM | Prisma | ^7.7.0 |
| Database | PostgreSQL | 13 |
| Intra API client | @codam/fast42 | ^2.1.7 |
| Authentication | Passport.js + passport-oauth2 | ^0.7.0 |
| Template engine | Nunjucks | ^3.2.4 |
| Session store | @quixo3/prisma-session-store | ^3.1.19 |
| Charting (client-side) | Chart.js | ^4.0.1 (via CDN) |
| Image rendering (server-side) | canvas | ^3.2.1 |
| Security headers | Helmet | ^8.1.0 |
| Session caching | node-cache | ^5.1.2 |

## Request Lifecycle

```
Browser / Intra webhook
        │
        ▼
  Express.js (src/main.ts)
        │
        ├─ Static assets (/static/*) → served directly, no auth
        ├─ Canvas routes (/canvas/*) → no auth required
        ├─ Webhook routes (/hooks/*) → no auth, validated by secret
        ├─ Login routes (/login, /logout) → Passport.js OAuth2 flow
        │
        ├─ checkIfAuthenticated middleware
        │       └─ redirects unauthenticated requests to /login
        │
        ├─ includeUser middleware → adds req.user to res.locals
        ├─ includeCoalitions middleware → adds all coalitions to res.locals (cached 50 min)
        │
        ├─ /admin/* → staffMiddleware (requires intraUser.kind === 'admin')
        │
        ├─ Route handler (src/routes/*)
        │       └─ queries PostgreSQL via Prisma
        │       └─ renders Nunjucks template (templates/*)
        │
        └─ Response → HTML page or JSON
```

## Directory Structure

```
coalition-system/
├── src/
│   ├── main.ts                  Entry point: Express server setup, starts sync loop
│   ├── env.ts                   Environment variable exports
│   ├── utils.ts                 Shared utility functions
│   ├── routes/
│   │   ├── login.ts             OAuth2 login / callback / logout
│   │   ├── home.ts              Dashboard (/)
│   │   ├── coalitions.ts        Coalition detail pages (/coalitions/:id)
│   │   ├── rankings.ts          Rankings view (/rankings)
│   │   ├── profile.ts           User profile (/profile)
│   │   ├── results.ts           Historical season results (/results)
│   │   ├── quiz.ts              Sorting Hat questionnaire (/quiz)
│   │   ├── charts.ts            Score history charts (/charts)
│   │   ├── canvas.ts            Server-rendered PNG displays (/canvas/*)
│   │   ├── admin/               Admin interface routes (/admin/*)
│   │   └── hooks/               Intra webhook handlers (/hooks/*)
│   ├── handlers/
│   │   ├── authentication.ts    Passport OAuth2 strategy setup
│   │   ├── db.ts                Prisma client singleton
│   │   ├── middleware.ts        Express middleware (auth checks, coalition cache)
│   │   ├── filters.ts           Nunjucks template filters
│   │   ├── points.ts            createScore / handleFixedPointScore / shiftScore
│   │   ├── intrascores.ts       Sync scores back to Intra API
│   │   └── session.ts           Express session types
│   ├── sync/
│   │   ├── base.ts              Sync orchestrator + Fast42 wrapper functions
│   │   ├── oauth.ts             OAuth token management for API calls
│   │   ├── users.ts             Sync IntraUser records
│   │   ├── blocs.ts             Sync IntraBloc + IntraBlocDeadline + IntraCoalition
│   │   ├── coalitions_users.ts  Sync IntraCoalitionUser membership
│   │   ├── cursus_users.ts      Sync IntraCursusUser enrollment
│   │   ├── groups.ts            Sync IntraGroup + IntraGroupUser
│   │   ├── projects.ts          Sync IntraProject metadata
│   │   ├── scores.ts            Push CodamCoalitionScore back to Intra
│   │   ├── fixed_point_types.ts Initialize CodamCoalitionFixedType records
│   │   ├── rankings.ts          Ranking bonus distribution + title creation
│   │   ├── results.ts           Season-end result snapshots
│   │   ├── titles.ts            Sync CodamCoalitionTitle to Intra
│   │   ├── cleanup.ts           Remove stale users/groups from the database
│   │   └── quiz.ts              Initialize quiz questions on first run
│   └── dev/                     Development-only utility scripts
├── templates/                   Nunjucks HTML templates
│   ├── base.njk                 Base layout
│   ├── admin/                   Admin interface templates
│   └── *.njk                    Student-facing page templates
├── static/                      Client-side assets (CSS, JS, fonts, images)
├── prisma/
│   ├── schema.prisma            Database schema (all models)
│   └── migrations/              Migration history
└── docs/                        This documentation
```

## Database Schema

### Core Codam Models

#### `CodamUser`
Represents a student tracked by the coalition system. The `id` matches the Intra user ID.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int (PK) | Intra user ID |

Relations: `coalition_scores`, `user_results`, `user_rankings`, `title_users`, `intra_user`

#### `CodamCoalition`
Extends an Intra coalition with custom metadata.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int (PK) | Intra coalition ID |
| `tagline` | String? | Short tagline displayed on the dashboard |
| `description` | String? | Longer description of the coalition |

Relations: `coalition_scores`, `coalition_test_answers`, `season_results`, `user_results`, `ranking_results`, `titles`, `intra_coalition`

#### `CodamCoalitionScore`
A single point award to a student. This is the central record of the scoring system.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int (PK) | Auto-increment |
| `coalition_id` | Int | Which coalition receives the points |
| `user_id` | Int | Which student earned the points |
| `amount` | Int | Number of points (can be negative) |
| `reason` | String | Human-readable description |
| `fixed_type_id` | String? | References a `CodamCoalitionFixedType`; null for custom/manual scores |
| `type_intra_id` | Int? | ID of the Intra object that triggered this score (e.g. `project_user.id`, `scale_team.id`, `location.id`). Used for idempotency. |
| `intra_score_id` | Int? | ID of the corresponding Score on Intra (after sync) |
| `created_at` | DateTime | When the score was awarded (used to assign scores to seasons) |

#### `CodamCoalitionFixedType`
Defines a named, configurable point category.

| Field | Type | Description |
|-------|------|-------------|
| `type` | String (PK) | Identifier, e.g. `"project"`, `"evaluation"`, `"exam"` |
| `description` | String | Human-readable description of the formula |
| `point_amount` | Int | Base amount or factor used in point calculations |
| `ranking_type` | String? | If set, scores of this type contribute to a `CodamCoalitionRanking` |

Default fixed types initialized on initial startup:

| Type | Default amount | Purpose |
|------|---------------|---------|
| `project` | 7 | Factor in project completion formula |
| `evaluation` | 40 | Points per 15-minute evaluation block |
| `point_donated` | 120 | Points per eval point donated to the pool |
| `logtime` | 10 | Points per hour of campus presence |
| `idle_logout` | -10 | Penalty for leaving a computer idling (negative) |
| `exam` | 1000 | Factor in exam score formula |
| `event_basic` | 1000 | Points for organizing a basic event |
| `event_intermediate` | 3000 | Points for organizing an intermediate event |
| `event_advanced` | 6000 | Points for organizing an advanced event |
| `ranking_bonus` | 0 | Not used directly; actual amounts come from ranking settings |

#### `CodamCoalitionRanking`
Defines a cross-coalition individual ranking (e.g. "Guiding Stars").

| Field | Type | Description |
|-------|------|-------------|
| `type` | String (PK) | Identifier, e.g. `"guiding_stars"` |
| `name` | String | Display name |
| `description` | String | Explanation of what this ranking measures |
| `top_title` | String | Title of the #1 spot (used for Intra title creation) |
| `top_title_intra_id` | Int? | Intra Title ID once created |
| `bonus_points` | Int? | Total points to distribute hourly during the last week of a season (divided into 168 hours) |
| `disabled` | Boolean | If true, this ranking is not calculated and no bonuses are awarded |
| `last_bonus_run` | DateTime? | Timestamp of the last hourly bonus run |

The ranking score for a user is the sum of all `CodamCoalitionScore` records where the `fixed_type.ranking_type` matches this ranking's `type`.

#### `CodamCoalitionSeasonResult`
A frozen snapshot of a coalition's final score at the end of a season.

| Field | Type | Description |
|-------|------|-------------|
| `coalition_id` | Int | The coalition |
| `score` | Int | The coalition's score — **not** the sum of all individual scores, but the mean score of all active contributors |
| `bloc_deadline_id` | Int | The season this result belongs to |

Unique constraint: `(coalition_id, bloc_deadline_id)`.

#### `CodamCoalitionUserResult`
A frozen snapshot of an individual student's score within a coalition at season end.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | Int | The student |
| `coalition_id` | Int | Their coalition at the time |
| `score` | Int | Their total points that season |
| `coalition_rank` | Int | Their rank within the coalition (1 = first) |
| `season_result_id` | Int | The parent `CodamCoalitionSeasonResult` |

#### `CodamCoalitionRankingResult`
A frozen snapshot of a student's position in a cross-coalition ranking at season end.

| Field | Type | Description |
|-------|------|-------------|
| `ranking_type` | String | Which ranking |
| `bloc_deadline_id` | Int | The season |
| `user_id` | Int | The student |
| `coalition_id` | Int? | Their coalition (nullable if they had none) |
| `score` | Int | Their ranking score that season |
| `rank` | Int | Their position in the ranking (1 = first) |

Unique constraint: `(bloc_deadline_id, ranking_type, user_id)`.

### Quiz (Sorting Hat) Models

#### `CodamCoalitionTestSettings`
Global quiz configuration. Only one record should exist (id = 1).

| Field | Type | Description |
|-------|------|-------------|
| `start_at` | DateTime | Quiz becomes available at this time |
| `deadline_at` | DateTime | Quiz closes at this time |

#### `CodamCoalitionTestQuestion`
A single quiz question.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int (PK) | Auto-increment |
| `question` | String | The question text |

#### `CodamCoalitionTestAnswer`
One answer option for a question, associated with a coalition.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int (PK) | Auto-increment |
| `question_id` | Int | The question this answer belongs to |
| `answer` | String | The answer text |
| `coalition_id` | Int | Which coalition this answer points to |
| `weight` | Int | Points added to that coalition's score when this answer is chosen (default 10, can be negative) |

### Title Models

#### `CodamCoalitionTitle`
A rank title within a coalition (e.g. "Gold Star" for #1, "Silver Star" for #2).

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int (PK) | Auto-increment |
| `title` | String (unique) | The title text |
| `intra_title_id` | Int? | The corresponding Title ID on Intra |
| `coalition_id` | Int | The coalition this title belongs to |
| `ranking` | Int | The rank position (1 = top of the coalition) |

Unique constraint: `(coalition_id, ranking)`.

#### `CodamCoalitionTitleUser`
Links a student to a title they currently hold.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | Int | The student |
| `title_id` | Int | The title |
| `intra_title_user_id` | Int? | The Intra `TitlesUsers` object ID |

### Intra Mirror Models

These models are read-only mirrors of data pulled from the Intra API.

| Model | Description |
|-------|-------------|
| `IntraUser` | Student account (login, email, display name, kind, pool info) |
| `IntraBloc` | Defines the entire coalition structure in Intra - rarely used directly |
| `IntraBlocDeadline` | A season within a bloc (begin_at, end_at, winner coalition_id) |
| `IntraCoalition` | Coalition metadata (name, slug, image_url, cover_url, color, score) |
| `IntraCoalitionUser` | Links a user to a coalition with their score and rank on Intra |
| `IntraGroup` | A user group (e.g. the assistant/C.A.T. group) |
| `IntraGroupUser` | Links a user to a group |
| `IntraCursusUser` | A student's enrollment in a cursus (with level, grade, begin/end dates) |
| `IntraProject` | Project metadata (name, slug, difficulty, exam flag) |

### Other Models

These models are used for internal application logic.

| Model | Description |
|-------|-------------|
| `IntraWebhook` | A received webhook delivery (delivery_id, model, event, body, status) |
| `IntraWebhookSecret` | Signing secrets per webhook model+event combination |
| `Session` | Express session records (managed by *@quixo3/prisma-session-store*) |
