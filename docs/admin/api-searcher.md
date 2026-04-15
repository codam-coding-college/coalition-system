# API Searcher

## Purpose

The API Searcher is a reusable frontend component that queries the Intra API and displays results in a browsable list. Its primary use is **manual point awarding** — admins can find a specific evaluation, project completion, location, or exam in the live Intra data and award the corresponding coalition points for it directly.

## When to Use It

**In development:** Webhooks are not available in a local development environment (Intra cannot reach `localhost`). The API Searcher allows developers to browse real Intra data and manually trigger point awards for testing purposes, simulating what a webhook would normally do automatically.

**In production:** Used as a fallback when a webhook failed to fire or was not delivered. Instead of waiting for a retry, an admin can look up the specific event on Intra and award the points manually.

## How It Works

The API Searcher consists of two parts:

**Backend (`src/routes/admin/apisearcher.ts`):** Provides a proxy API that the frontend calls to fetch Intra data with appropriate filtering. It defines default filter sets for each data type:
- `API_DEFAULT_FILTERS_PROJECTS` — project completions (also used by the catchup tool)
- `API_DEFAULT_FILTERS_SCALE_TEAMS` — evaluations (also used by the catchup tool)
- `API_DEFAULT_FILTERS_LOCATIONS` — campus locations (also used by the catchup tool)

**Frontend (`static/js/apisearcher-*.js`):** A JavaScript library that can be embedded into any admin page. It renders a search form and paginated result list. Each result row has an "Award points" button that calls the appropriate point handler for that event type.

## Integration

The API Searcher is embedded as a component within admin pages (primarily the points management pages) rather than existing as a standalone page. The Nunjucks admin templates include it where relevant, and the frontend library wires up the search form and result buttons to the backend proxy.

## Routes

| Route | Description |
|-------|-------------|
| `GET /admin/apisearcher` | Main page with the embedded searcher component |
| `GET /admin/apisearcher/api/*` | Backend proxy for Intra API requests |
