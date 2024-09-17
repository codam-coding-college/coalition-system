// Load the .env file
import dotenv from 'dotenv';
dotenv.config({ path: '.env', debug: true });

// Imports for the server
import express from 'express';
import { handleServerShutdown } from './handlers/shutdown';

// Imports for the database connection
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Imports for the Intra API
import Fast42 from '@codam/fast42';
import { INTRA_API_UID, INTRA_API_SECRET } from './env';
import { syncWithIntra } from './intra/base';
let initSyncComplete = false;

// Imports for the handlers and routes
import { setupPassport, usePassport } from './handlers/authentication';
import { setupNunjucksFilters } from './handlers/filters';
import { setupExpressMiddleware } from './handlers/middleware';
import { setupLoginRoutes } from './routes/login';
import { setupQuizRoutes } from './routes/quiz';

// Set up the Express app
const app = express();

// Configure passport for OAuth2 authentication with Intra
setupPassport(prisma);

// Configure custom nunjucks filters for the templating engine
setupNunjucksFilters(app);

// Configure Express to use passport for authentication
usePassport(app);

// Wait for the Intra synchronization to finish before showing any pages on startup
app.use(async function(req: express.Request, res: express.Response, next: express.NextFunction) {
	if (!initSyncComplete) {
		console.log(`A visitor requested the path ${req.path}, but we haven't finished syncing yet. Showing a waiting page.`);
		res.render('syncing.njk');
		res.status(503);
	}
	else {
		next();
	}
});

// Configure the Express app to use specific middleware for each request
setupExpressMiddleware(app);

// Set up routes
setupLoginRoutes(app);
setupQuizRoutes(app, prisma);

// Start the Express server
app.listen(4000, async () => {
	console.log('Server is running on http://localhost:4000');

	// Make sure to save the timestamp of when the server exits (to synchronize with missed events)
	process.on('exit', handleServerShutdown);
	process.on('SIGINT', handleServerShutdown);
	process.on('SIGTERM', handleServerShutdown);

	try {
		const api = await new Fast42([{
			client_id: INTRA_API_UID,
			client_secret: INTRA_API_SECRET,
		}]).init();

		await syncWithIntra(api);
		initSyncComplete = true;
	}
	catch (error) {
		console.error('Failed to initialize the Intra API:', error);
		process.exit(1);
	}
});
