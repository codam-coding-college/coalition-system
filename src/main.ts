// Load the .env file
import dotenv from 'dotenv';
dotenv.config({ path: '.env', debug: true });

// Imports for the server
import express from 'express';

// Imports of security middleware
import helmet from "helmet";

// Imports for the database connection
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Imports for the Intra API
import Fast42 from '@codam/fast42';
import { INTRA_API_UID, INTRA_API_SECRET, NODE_ENV } from './env';
import { syncWithIntra } from './sync/base';
let initSyncComplete = false;

// Imports for the handlers and routes
import { setupPassport, usePassport } from './handlers/authentication';
import { setupNunjucksFilters } from './handlers/filters';
import { setupExpressMiddleware } from './handlers/middleware';
import { setupLoginRoutes } from './routes/login';
import { setupHomeRoutes } from './routes/home';
import { setupProfileRoutes } from './routes/profile';
import { setupResultsRoutes } from './routes/results';
import { setupChartRoutes } from './routes/charts';
import { setupQuizRoutes } from './routes/quiz';
import { setupAdminRoutes } from './routes/admin';
import { setupWebhookRoutes } from './routes/hooks';
import { setupCanvasRoutes } from './routes/canvas';

export let api: Fast42 | null = null;

const main = async () => {
	try {
		api = await new Fast42([{
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

	// Set up the Express app
	const app = express();

	// Adding helmet
	app.use(helmet.contentSecurityPolicy({
		directives: {
			"defaultSrc": ["'self'"],
			"scriptSrc": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net/", "https://cdnjs.cloudflare.com/"],
			"styleSrc": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net/"],
			"imgSrc": ["'self'", "data:", "https://cdn.intra.42.fr/"],
			"connectSrc": ["'self'", "https://cdn.jsdelivr.net/", "https://cdnjs.cloudflare.com/"], // For fetch, XMLHttpRequest, WebSocket, EventSource
			"fontSrc": ["'self'", "data:"],
			"objectSrc": ["'none'"],
			"frameAncestors": ["'none'"],
			"baseUri": ["'self'"],
			"formAction": ["'self'"],
			"upgradeInsecureRequests": (NODE_ENV === 'production') ? [] : null,
		}
	}));

	// Configure passport for OAuth2 authentication with Intra
	setupPassport(prisma);

	// Configure custom nunjucks filters for the templating engine
	setupNunjucksFilters(app);

	// Configure Express to use passport for authentication
	usePassport(app, prisma);

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
	setupHomeRoutes(app, prisma);
	setupProfileRoutes(app, prisma);
	setupResultsRoutes(app, prisma);
	setupChartRoutes(app, prisma);
	setupQuizRoutes(app, prisma);
	setupAdminRoutes(app, prisma);
	setupWebhookRoutes(app, prisma);
	setupCanvasRoutes(app, prisma);

	// Start the Express server
	app.listen(4000, async () => {
		console.log('Server is running on http://localhost:4000 in ' + NODE_ENV + ' mode');
	});

	// Schedule the Intra synchronization to run every 10 minutes
	setInterval(async () => {
		await syncWithIntra(api!);
	}, 10 * 60 * 1000);
};

main(); // is async because of API synchronization
