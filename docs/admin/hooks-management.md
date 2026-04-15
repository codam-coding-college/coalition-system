# Hooks Management

The hooks management admin section provides tools for monitoring webhook deliveries, manually triggering webhooks, and catching up on missed events.

## Webhook Delivery Log

**Route:** `GET /admin/hooks/history`

Lists all `IntraWebhook` records in reverse chronological order in a paginated format. Each record shows:

| Field | Description |
|-------|-------------|
| `delivery_id` | Unique ID assigned by Intra for this delivery |
| `received_at` | When the webhook was received |
| `handled_at` | When processing completed |
| `model` | The Intra model that triggered the webhook (e.g. `projects_users`) |
| `event` | The event type (e.g. `update`) |
| `status` | `Handled`, `Skipped`, or `Error` |
| `body` | The JSON payload sent by Intra |
| `actions` | Retrigger the webhook, essentially running the receive logic again |

## Webhook Secret Management

**Route:** `GET /admin/hooks/secrets`

Each model+event combination has its own signing secret (`IntraWebhookSecret`). The coalition system validates the Intra-signed request before processing.

Secrets can be added, edited, and deleted from the hooks management page. The composite primary key is `(model, event)` — one secret per event type.

## Manual Trigger

The manual trigger form sends a test webhook payload to the application as if it came from Intra. This is useful for testing webhook handlers without waiting for a real event.

This manual trigger can be done per webhook via the [Webhook Delivery Log](#webhook-delivery-log).

## Catchup Tool

**Route:** `GET /admin/hooks/catchup`

When the coalition system is offline, a webhook delivery fails, or after a new season has started, the catchup tool allows admins to retroactively process missed events for a specific date range by querying the Intra API.

### How to Use

1. Select a start date and end date for the catchup window
2. Choose which event types to catch up (locations, projects/exams, evaluations)
3. Submit the form — the catchup runs asynchronously in the background
4. Progress (0–100%) is displayed on the page and updates as the operation proceeds

### Supported Event Types

| Event type | Description |
|-----------|-------------|
| Locations | Campus checkout events (logtime points) |
| Projects & exams | Project and exam validations |
| Evaluations | Peer evaluation completions |

### Not Supported

**Pool donations** cannot be caught up. There is no Intra API endpoint that lists historical correction point donations. This is a known limitation.

### Performance Note

The evaluations catchup can be slow because the Intra API's `/scale_teams` endpoint requires a very small page size (2 results per page) to avoid timeouts. Large date ranges may take several minutes. It may also just give up and the coalition system may crash entirely. A new catchup operation can then be started to try again.

See [sync/webhooks.md](../sync/webhooks.md) for technical details on how catchup works internally.
