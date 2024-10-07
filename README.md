# Codam's Custom Coalition System

A work in progress.

## To-do list

### Deployment
- [ ] Finalize containerization
- [x] Switch to containerized postgres database
- [ ] Automatically increase package.json version on new release using GitHub Action

### Questionnaire
- [x] Code questionnaire
- [x] Code questionnaire results
- [x] Only make questionnaire available between specific dates set by admin
- [ ] Allow specific users to fill in the quiz on admin approval

### Points system & tournament
- [x] Implement Codam's new point system
- [x] Improve Codam's new point system (add custom project point system, rip out Intra's)
- [x] Set up automated points system using Intra webhooks
- [ ] Implement Intra's bloc tournament system

### Student interface
- [ ] Create dashboard
- [ ] Create graphs
- [ ] Create various leaderboard statistics
- [ ] Create tournament history overview with historical wins

### Admin / staff interface
- [ ] Create dashboard
- [x] Create interface for editing the questionnaire
- [x] Create interface to manually trigger webhooks (manually re-assign automated points)
- [ ] Create interface to fetch potentially missed webhooks between specific dates
- [x] Create point history interface where admin can delete, recalculate and synchronize points with Intra
- [x] Create interface to edit automated point system
- [x] Implement method to recalculate already given points
- [ ] Create interface for manually assigning custom points
- [ ] Create interface for manually assigning points for organizing events

### Intra connection (API & Webhooks)
- [ ] Implement a way of synchronizing points with Intra
- [ ] Implement a way of averaging out the points on Intra too (bot user with minus points for each coalition?)
- [ ] Implement a way of syncing existing Intra points including historical ones
- [ ] Find a way of blocking Intra's coalitions_user creation
- [ ] Re-implement old [coalition rank system](https://github.com/codam-coding-college/coalition-ranks)

If you're a student and want to contribute to this project, talk to the staff about it first to figure out what is possible and discuss implementation ideas.

## Development
1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the project
4. Start the PostgreSQL database using Docker: `docker-compose -f docker-compose.dev.yml up -d`
5. Run `npm run start` to start the server and seed the initial database

### Reseed the database
1. Delete the *.shutdown-timestamp* file in the root directory
2. Run `npm run build && npm run start`

### Add initial questionnaire questions
Run `node build/dev/create_quiz_questions.js` after running `npm run build`
