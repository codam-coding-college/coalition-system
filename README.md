# Codam's Custom Coalition System

A work in progress.

## To-do list

### Deployment
- [ ] Finalize containerization
- [ ] Switch to containerized postgres database

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

## Development
1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the project
4. Run `npm run resetdb` (warning: this will destroy any existing database and recreate it if one exists. On new clones, none should exist)
5. Run `npm run start` to start the server and seed the initial database

### Reseed the database
1. Delete the *.shutdown-timestamp* file in the root directory
2. Run `npm run build && npm run start`

### Add initial questionnaire questions
Run `node build/dev/create_quiz_questions.js` after running `npm run build`
