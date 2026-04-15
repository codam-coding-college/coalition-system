# Development

## Prerequisites

- Node.js (v22+)
- Docker & Docker Compose (for the development database)
- A 42 Intra API application (OAuth2 credentials + database synchronization)

## Local Setup

1. Clone the repository and install dependencies:
   ```bash
   git clone <repo-url>
   cd coalition-system
   npm install
   ```

2. Copy the example environment file and fill in the values:
   ```bash
   cp .env.example .env
   # Edit .env with your Intra API credentials, database settings, etc.
   ```
   See [configuration.md](configuration.md) for a description of every variable.

3. Start the development PostgreSQL database:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

4. Build and start the application:
   ```bash
   npm run build
   npm start
   ```
   The application runs on port 4000 by default (`URL_ORIGIN` in `.env`).

5. Access the application at `http://localhost:4000`.

## npm Scripts

| Script | What it does |
|--------|-------------|
| `npm run build` | Runs `prisma generate` then `tsc` — compiles TypeScript to `build/` |
| `npm start` | Applies pending Prisma migrations, then starts the compiled application. Also starts the Intra sync loop. |
| `npm run start:nosync` | Same as `npm start` but passes `--nosync` to skip the Intra sync loop. Useful when developing features that do not need live Intra data. |

## Running Without Intra Sync

Pass the `--nosync` flag (via `npm run start:nosync`) to start the server without connecting to the Intra API. The application still requires a valid database with seeded data (see dev scripts below).

## DEV_DAYS_LIMIT

In development, the sync fetches only the last N days of Intra data to avoid pulling years of historical records. Set the shell variable before running:

```bash
DEV_DAYS_LIMIT=30 npm start
```

Default is 365 days. This variable is read from the shell environment, not from `.env`.

## Dev Utility Scripts

After running `npm run build`, the following scripts are available in `build/dev/`. Run them with:

```bash
node build/dev/<script-name>.js
```

| Script | Description |
|--------|-------------|
| `create_quiz_questions.js` | Populates the database with default quiz questions and answers |
| `create_rankings.js` | Creates initial cross-coalition ranking definitions |
| `create_codam_titles.js` | Creates initial coalition title definitions - **DO NOT RUN IF NOT FROM CODAM, ESPECIALLY NOT IN PRODUCTION** |
| `test_create_score.js` | Test if the Coalition System is able to create scores on Intra |
| `delete_synced_intra_scores.js` | Deletes all scores that have been synced to Intra. Useful if development scores were accidentally pushed to production Intra. |
| `get_intra_scoreable_types.js` | Introspects the Intra API to list all scoreable project/event types |
| `recalculate_pool_donation_scores.js` | Recalculates point_donated scores with the current fixed point settings |
| `remove_all_intra_titles.js` | Deletes all obtained coalition titles from users on Intra. Warning: this action is irreversible. |
| `delete_all_results.js` | Deletes all results from the database. Useful for testing a full sync from scratch. Warning: irreversible. |
| `delete_all_scores.js` | Deletes all scores from the database. Useful for testing score awarding logic without having to reset the entire database. Warning: irreversible. |
| `delete_all_sessions.js` | Deletes all user sessions from the database, essentially logging out all users. Warning: irreversible. |

## Database Migrations

Migrations are applied automatically on `npm start` via `npx prisma migrate deploy`. To create a new migration during development:

```bash
npx prisma migrate dev --name <migration-name>
```

To inspect the database with Prisma Studio:

```bash
npx prisma studio
```
