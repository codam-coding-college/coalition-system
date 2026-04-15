# Configuration

## Environment Variables

All variables are loaded from a `.env` file by `src/env.ts` using `dotenv`. Copy `.env.example` to `.env` and fill in the values before running the application.

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | No | `development` or `production`. Controls sync-to-Intra behavior and logging. Defaults to `development`. | `production` |
| `URL_ORIGIN` | Yes | Base URL of the application. Used for OAuth2 callback and Intra links. | `https://coalition.codam.nl` |
| `SESSION_SECRET` | Yes | Secret used to sign Express session cookies. Use a long random string. | `some-very-long-random-string` |
| `INTRA_API_UID` | Yes | OAuth2 client ID for the Intra API application. | `u-s4t2...` |
| `INTRA_API_SECRET` | Yes | OAuth2 client secret for the Intra API application. | `s-s4t2...` |
| `INTRA_CAMPUS_ID` | Yes | The campus ID on Intra. Used when fetching campus-specific users and locations. **The value for this variable must not be changed once the application is in production.** | `14` |
| `INTRA_CURSUS_ID` | Yes | The cursus ID on Intra for the main program. Only students enrolled in this cursus receive coalition points. **The value for this variable must not be changed once the application is in production.** | `21` |
| `INTRA_ASSISTANT_GROUP_ID` | Yes | The Intra group ID for the Piscine Assistants (CATs at Codam). Used to determine who can access the quiz when `ASSISTANTS_CAN_QUIZ` is enabled and who gets listed in the assistant list in the coalition overview UI. Does **not** grant admin access. | `68` |
| `INTRA_TEST_ACCOUNTS` | No | Comma-separated list of Intra logins that should be excluded from point awarding (used for staff test accounts). | `ctest,karthur` |
| `ASSISTANTS_CAN_QUIZ` | No | Set to `true` to allow CATs (Codam Assistant Team) to take the coalition quiz. Intended for use during the piscine, where CATs participate in the piscine's coalition system without being able to receive any points. Defaults to `false`. | `true` |
| `POSTGRES_USER` | Yes | PostgreSQL username. | `coalition` |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password. | `password` |
| `POSTGRES_DB` | Yes | PostgreSQL database name. | `coal` |
| `POSTGRES_HOST` | Yes | PostgreSQL host. | `localhost` |
| `PRISMA_DB_URL` | Yes | Full PostgreSQL connection string used by Prisma. | `postgresql://POSTGRES_USER:POSTGRES_PASSWORD@POSTGRES_HOST:5432/POSTGRES_DB` |

### Shell-only Variables

These are not read from `.env` but from the shell environment:

| Variable | Description | Default |
|----------|-------------|---------|
| `DEV_DAYS_LIMIT` | In development mode, limits data fetched from Intra to the last N days. Prevents pulling years of data during local development. | `365` |

## Docker Setup

### Production (`docker-compose.yml`)

Runs both the PostgreSQL database and the application container. The app is built from the `Dockerfile`, which compiles TypeScript and runs `npm start` (which applies Prisma migrations before starting).

```
services:
  db       → PostgreSQL 13, data volume, port 5432
  app      → Node.js app, port 4000, depends on db to be up and running
```

Mount points:
- `./.env` → `/app/.env` (required)
- `./.sync-timestamp` → `/app/.sync-timestamp` (optional, see below)

### Development (`docker-compose.dev.yml`)

Runs only the PostgreSQL database. The application is run locally via `npm run build && npm start`.

```
services:
  db  → PostgreSQL 13, port 5432
```

## The `.sync-timestamp` File

The file `.sync-timestamp` in the project root stores a Unix timestamp (milliseconds) of the last successful Intra sync.

**How it is used:**
- On startup, the sync logic reads this file. If it exists, only data updated since that timestamp is fetched from Intra (incremental sync).
- If the file is missing or unreadable, the sync fetches all historical data (full sync).
- In development mode, even on a full sync, data is limited to the last `DEV_DAYS_LIMIT` days.

**Forcing a full resync:**
Delete the `.sync-timestamp` file and restart the application:
```bash
rm .sync-timestamp
npm start
```

This is useful after database resets.

> Keep in mind that scores are not awarded during sync, so if you want to catch up on missed scores due to the database being down for a long time, use the [Webhook Catchup feature](admin/hooks-management.md#catchup-tool) instead.
