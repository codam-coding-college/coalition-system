# Codam's Custom Coalition System

A work in progress.

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
