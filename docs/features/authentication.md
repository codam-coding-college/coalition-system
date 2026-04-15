# Authentication

## Overview

The coalition system authenticates users exclusively via the 42 Intra OAuth2 flow. There are no local passwords. Once authenticated, a user's session is stored in the PostgreSQL database.

## OAuth2 Login Flow

1. The user visits any protected page and is redirected to `/login`.
2. `/login` redirects to the Intra OAuth2 authorization endpoint using `passport-oauth2`.
3. After the user authorizes the application on Intra, Intra redirects back to `/login/callback`.
4. Passport fetches the user's profile from the Intra API using the user's access token.
5. The user is stored in the Express session and redirected to the page they originally tried to visit (stored as `session.returnTo`).

OAuth credentials are configured via `INTRA_API_UID` and `INTRA_API_SECRET`. The callback URL is `{URL_ORIGIN}/login/callback`.

Relevant files: `src/routes/login.ts`, `src/handlers/authentication.ts`

## Session Management

Sessions are stored in the `Session` table via `@quixo3/prisma-session-store`. The session is signed with `SESSION_SECRET`.

The `CustomSessionData` type (defined in `src/handlers/session.ts`) extends the default session with:
- `returnTo` — the URL the user was trying to access before being redirected to login
- `quiz` — in-progress quiz state (current question, answers so far, coalition scores)

## Middleware

Three pieces of middleware run on every request (configured in `src/handlers/middleware.ts`):

**`checkIfAuthenticated`** — runs on all routes:
- Passes through: `/login*`, `/logout`, `/hooks/*`, `/static/*`, `/canvas*`, and 503 responses
- For all other routes: redirects unauthenticated users to `/login`, saving `returnTo`

**`includeUser`** — adds `res.locals.user` (the `IntraUser` object) so all Nunjucks templates can access it.

**`includeCoalitions`** — adds `res.locals.coalitions` (all coalitions with basic Intra data) to every request. The result is cached in memory for 50 minutes to avoid repeated database queries.

## Role-Based Access

There are two access levels:

### Students

Any authenticated user with an active cursus enrollment (`IntraCursusUser` with `cursus_id = INTRA_CURSUS_ID`) can access student-facing routes.

### Assistants (CATs at Codam)

`INTRA_ASSISTANT_GROUP_ID` does **not** grant admin access. It identifies the Piscine Assistant (CATs at Codam) group membership, which is only used for quiz access control (see [quiz.md](quiz.md)). Other than that, they have similar access to regular students.

### Staff (Admin)

Admin access is granted to users whose Intra account has `kind === 'admin'`. This is set by Intra itself for staff members. The check is performed by `isStaff()` in `src/utils.ts`:

```typescript
export const isStaff = async function(intraUser): Promise<boolean> {
    return intraUser.kind === 'admin';
};
```

The `staffMiddleware` in `src/handlers/middleware.ts` applies this check to all `/admin/*` routes and returns HTTP 403 if the check fails.

## Routes

| Route | Description |
|-------|-------------|
| `GET /login` | Redirects to Intra OAuth2 authorization page |
| `GET /login/callback` | OAuth2 callback; creates/updates user records and establishes session |
| `GET /logout` | Destroys the session and redirects to `/login` |
