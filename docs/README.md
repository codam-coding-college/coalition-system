# Coalition System Documentation

The Codam Coalition System is a full-stack web application that manages student-coalition competition at Codam Coding College, part of the 42 Network. Students are sorted into teams (coalitions) and compete for points earned through their academic activity — projects, evaluations, logtime, events, and more. The system integrates tightly with the 42 Intra platform via OAuth2 and webhooks.

## Table of Contents

### Architecture & Setup

| Document | Description |
|----------|-------------|
| [architecture.md](architecture.md) | Tech stack, directory structure, and full database schema |
| [configuration.md](configuration.md) | Environment variables, Docker setup, and the sync timestamp file |
| [development.md](development.md) | Local development setup, npm scripts, and dev utility scripts |

### Features

| Document | Description |
|----------|-------------|
| [features/authentication.md](features/authentication.md) | OAuth2 login via Intra, sessions, and role-based access control |
| [features/coalitions.md](features/coalitions.md) | Coalition structure, blocs, seasons, and how coalition scores are calculated |
| [features/scoring.md](features/scoring.md) | The point system: fixed types, all point formulas, and idempotency |
| [features/quiz.md](features/quiz.md) | The Sorting Hat questionnaire that assigns students to coalitions |
| [features/rankings.md](features/rankings.md) | Cross-coalition individual rankings and season-end bonus point distribution |
| [features/titles.md](features/titles.md) | Coalition titles (rank achievements) and their sync to Intra |
| [features/charts.md](features/charts.md) | Interactive score history charts for coalitions |
| [features/canvas.md](features/canvas.md) | Server-rendered 1920×1080 PNG displays for physical campus screens |

### Intra Synchronization

| Document | Description |
|----------|-------------|
| [sync/overview.md](sync/overview.md) | Sync lifecycle, startup vs. periodic sync, Fast42 wrapper functions, and why we snapshot results |
| [sync/webhooks.md](sync/webhooks.md) | Webhook event handlers, point awards, and the catchup tool |

### Admin Interface

| Document | Description |
|----------|-------------|
| [admin/overview.md](admin/overview.md) | Admin access control and a map of all admin routes |
| [admin/points-management.md](admin/points-management.md) | Manual, event, and CSV point assignment; per-score operations; shift tool |
| [admin/quiz-management.md](admin/quiz-management.md) | Managing quiz questions, answers, weights, and availability windows |
| [admin/rankings-management.md](admin/rankings-management.md) | Configuring ranking types and bonus point pools |
| [admin/titles-management.md](admin/titles-management.md) | Managing coalition titles and syncing them to Intra |
| [admin/hooks-management.md](admin/hooks-management.md) | Webhook delivery log, manual triggers, and the catchup tool |
| [admin/api-searcher.md](admin/api-searcher.md) | The Intra API search library used for manual point awarding |
