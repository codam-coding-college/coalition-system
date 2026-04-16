# Webhooks

## Overview

Intra sends webhooks to the coalition system whenever relevant student activities occur. These webhooks trigger point awards in real time, without waiting for the next periodic sync.

All webhook endpoints are under `/hooks/*` and are exempt from the login middleware (they are called by Intra and not by a user). Each delivery is logged as an `IntraWebhook` record in the database.

## Delivery Flow

```
Intra → POST /hooks/:model/:event
    1. Validate webhook secret
    2. Store IntraWebhook record (status: "pending")
    3. Parse JSON body
    4. Call event handler
    5. Update IntraWebhook status: "Handled", "Skipped", or "Error"
    6. Return HTTP 200
```

Intra expects an HTTP 200 response quickly. Long processing is done asynchronously where possible.

## Webhook Secrets

Each model+event combination has its own signing secret, stored in `IntraWebhookSecret`. Intra signs the request body with this secret, and the coalition system validates the signature before processing.

Secrets are managed in the admin interface. See [admin/hooks-management.md](../admin/hooks-management.md#webhook-secret-management).

## Webhook Status Values

| Status | Meaning |
|--------|---------|
| `unhandled` | The webhook was received but not yet processed (initial state) |
| `skipped` | The event was received but intentionally not acted on (e.g. project not validated, user not in database) |
| `ok` | The event was processed and points were awarded |
| `error` | An unexpected error occurred during processing |
| `already_handled` | The event was already processed in a previous delivery (idempotency check) |
| `secret_config_missing` | No webhook secret configured for this model+event, so the webhook was rejected |
| `incorrect_secret` | The webhook signature did not match the configured secret, so the webhook was rejected |

## Event Handlers

### `projects_users:update` — Project and Exam Completion

**File:** `src/routes/hooks/projects_users.ts`

Triggered when a student's project or exam is updated on Intra.

**Skipped if:**
- `status !== "finished"`, `validated? !== true` — project not yet graded as passed
- `marked_at` is null - project not evaluated yet
- `final_mark` is null or negative
- Project not found in the local database
- Project has `difficulty = 0` or `null` (and is not a rush or an exam)
- Point amount is set to 0 for the corresponding fixed point formula (project or exam)

**Point formulas:** See [features/scoring.md](../features/scoring.md) for the project, rush and exam formulas.

The `projectUser.id` is used as `type_intra_id` for idempotency. If a student retakes a project and scores higher, the difference is awarded as an additional score rather than a full re-award.

### `scale_teams:update` — Evaluation Completion

**File:** `src/routes/hooks/scale_teams.ts`

Triggered when a peer evaluation is completed on Intra. Points go to the **corrector** (the evaluator), not the person being evaluated.

**Skipped if:**
- `filled_at` is null — evaluation not yet completed
- Corrector login is `"invisible"` - the API key in use is owned by a student that does not have permission (yet) to see the corrector
- Corrector login is `"supervisor"` — this is an internship evaluation by an external company
- Corrector user is not found in the local database
- Point amount is set to 0 for the evaluation fixed point formula

**Point formula:** See [features/scoring.md](../features/scoring.md) for the evaluation formula, including the double-points multiplier that applies during evaluation points sales.

The `scaleTeam.id` is used as `type_intra_id` for idempotency.

### `pools:point_given` — Correction Point Donation

**File:** `src/routes/hooks/pools.ts`

Triggered when a student donates evaluation points to the correction pool.

**Skipped if:**
- `given_by` is null - the points were not donated by a user
- Point amount is set to 0 for the evaluation point donation fixed point formula

**Point formula:** See [features/scoring.md](../features/scoring.md) for the point donation formula.

`type_intra_id` is **not** set for pool donations (it is passed as `null`). This means pool donations are not idempotent by default and cannot be replayed safely.

**Important:** Pool donations **cannot** be caught up retroactively via the [webhook catchup tool](../admin/hooks-management.md#catchup-tool). There is no Intra API endpoint that lists historical point donations.

### `locations:close` — Campus Location Checkout

**File:** `src/routes/hooks/locations.ts`

Triggered when a student's campus location session ends (they log out of a computer).

**Skipped if:**
- Point amount is set to 0 for the logtime fixed point formula

**Point formula:** See [features/scoring.md](../features/scoring.md) for the logtime formula.

The `location.id` is used as `type_intra_id` for idempotency.

### `users:idlelogout` — Idle Automatic Logout

**File:** `src/routes/hooks/idlelogout.ts`

This is **not** a standard Intra webhook. It is a **custom endpoint that the campus cluster computers must call** when they automatically log out an idle user. Care should be taken not to accidentally expose the secret used by this webhook endpoint to the public, otherwise anyone could trigger idle logout events for any user.

Awards a flat penalty of `idle_logout.point_amount` (default −10 points). The intent is to discourage students from remaining logged in while away, since idle logtime would otherwise accumulate points.

**Skipped if:**
- Point amount is set to 0 for the idle logout fixed point formula

`type_intra_id` is not set for idle logouts (no Intra object ID to reference). Therefore idle logout events are not idempotent by default and cannot be replayed safely.

## Catchup Tool

When the coalition system is offline or a webhook delivery fails, Intra does not retry indefinitely. The catchup tool allows admins to retroactively process missed events for a specific date range by querying the Intra API directly.

See [admin/hooks-management.md](../admin/hooks-management.md#catchup-tool) for more info.
