# Codam's Custom Coalition System

A work in progress.

## To-do list

### Deployment
- [x] Finalize containerization
- [x] Switch to containerized postgres database

### Questionnaire
- [x] Code questionnaire
- [x] Code questionnaire results
- [x] Only make questionnaire available between specific dates set by admin
- [x] Allow users without an assigned coalition to always fill in the questionnaire

### Points system & tournament
- [x] Implement Codam's new point system
- [x] Improve Codam's new point system (add custom project point system, rip out Intra's)
- [x] Set up automated points system using Intra webhooks
- [x] Implement Intra's bloc season system
- [x] Implement a way of assigning bonus points to top ranking students in seasons

### Student interface
- [x] Create basic dashboard
- [x] Create basic graphs
- [x] Create various rankings
- [x] Create season history overview with historical wins

### Admin / staff interface
- [x] Create dashboard
- [x] Create interface for editing the questionnaire
- [x] Create interface to manually trigger webhooks (manually re-assign automated points)
- [x] Create interface to fetch potentially missed webhooks between specific dates
- [x] Create point history interface where admin can delete, recalculate and synchronize points with Intra
- [x] Create interface to edit automated point system
- [x] Implement method to recalculate already given points
- [x] Create interface for manually assigning custom points
- [x] Create interface for manually assigning points for organizing events

### Intra connection (API & Webhooks)
- [x] Implement a way of synchronizing points with Intra
- [x] Implement a way of averaging out the points on Intra
- [ ] Implement a way of syncing existing Intra points including historical ones
- [ ] Find a way of blocking Intra's coalitions_user creation
- [ ] Implement granting titles for top #1 of each ranking at the end of each season
- [ ] Re-implement old [coalition rank titles system](https://github.com/codam-coding-college/coalition-ranks)

If you're a student and want to contribute to this project, talk to the staff about it first to figure out what is possible and discuss implementation ideas.

## Development
1. Clone the repository
2. Fill the `.env` file with the necessary environment variables (don't forget to change the POSTGRES_HOST in the PRISMA_DB_URL variable to localhost)
3. Run `npm install` to install dependencies
4. Run `npm run build` to build the project
5. Start the PostgreSQL database using Docker: `docker-compose -f docker-compose.dev.yml up -d`
6. Run `npm run start` to start the server and seed the initial database
7. Optional:
	- run `node build/dev/create_quiz_questions.js` to seed the database with initial questionnaire questions
	- run `node build/dev/create_rankings.js` to seed the database with initial rankings
	- synchronize some data from Intra using the Webhook Catch-up tool in the Admin interface

### Reseed the database
1. Delete the *.sync-timestamp* file in the root directory
2. Run `npm run build && npm run start`

### Add initial questionnaire questions
Run `node build/dev/create_quiz_questions.js` after running `npm run build`
