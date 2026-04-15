# Codam's Custom Coalition System

The Codam Coalition System is a web application that manages student-coalition competition at Codam Coding College, part of the 42 Network. Students are sorted into teams (coalitions) and compete for points earned through their academic activity — projects, evaluations, logtime, events, and more. Points are awarded automatically via Intra webhooks and synchronized back to Intra.

It is a replacement for 42's existing coalition system, intending to make it more fair, engaging, and transparent for students while giving staff more control and flexibility in how the competition is structured.

## Features

- **Sorting Hat quiz** — students answer a weighted questionnaire to get placed into a coalition
- **Points system** — automatic point awards for projects, exams, evaluations, logtime, and event organization
- **Coalition leaderboard** — coalitions compete based on the mean score of their active contributors
- **Individual rankings** — cross-coalition leaderboards measuring specific engagement types
- **Titles** — top-ranked students receive titles that appear on their Intra profile
- **Season history** — frozen snapshots of final standings at the end of each season
- **Canvas displays** — server-rendered 1920×1080 PNG images with real-time colorful data for campus screens
- **Admin interface for staff** — point management, quiz editor, webhook tools, and more

## Documentation

Full documentation is in the [`docs/`](docs/) folder:

| Section | Description |
|---------|-------------|
| [Architecture](docs/architecture.md) | Tech stack, directory structure, and database schema |
| [Configuration](docs/configuration.md) | Environment variables and Docker setup |
| [Development](docs/development.md) | Local setup, npm scripts, and dev utilities |
| [Features](docs/features/coalitions.md) | Coalitions, scoring, quiz, rankings, titles, charts, canvas |
| [Intra Sync](docs/sync/overview.md) | How and when data is synchronized with Intra |
| [Webhooks](docs/sync/webhooks.md) | Webhook event handlers and the catchup tool |
| [Admin Interface](docs/admin/overview.md) | Admin routes and tools |

## Quick Start

See [docs/development.md](docs/development.md) for full setup instructions. In brief:

```bash
cp .env.example .env          # fill in your Intra API credentials and database settings
npm install
docker compose -f docker-compose.dev.yml up -d   # start PostgreSQL
npm run build && npm start
```

The application runs on port 4000. Access it at `http://localhost:4000`.

## Contributing

If you are a student and want to contribute, talk to the Codam staff first to discuss what is possible and to align on implementation ideas.

If you are a staff member from another campus and want to set up a similar system, we recommend forking this repository and customizing it to your campus's needs. Feel free to reach out to the Codam staff for guidance on how to adapt the system to your context.
