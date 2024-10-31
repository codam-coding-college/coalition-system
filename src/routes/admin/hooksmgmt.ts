import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { CatchupOperation, startCatchupOperation } from '../hooks/catchup';

const catchupOperation: CatchupOperation = {
	ongoing: false,
	startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // Default value
	endDate: new Date(), // Default value
	progress: 0,
	filter: {
		locations: false,
		projects: false,
		evaluations: false,
		pool_donations: false,
	}
};

export const setupWebhookManagementRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/hooks/history', async (req, res) => {
		return res.render('admin/hooks/history.njk');
	});

	app.get('/admin/hooks/catchup', async (req, res) => {
		return res.render('admin/hooks/catchup.njk', {
			catchupOperation,
		});
	});

	app.post('/admin/hooks/catchup', async (req, res) => {
		if (catchupOperation.ongoing) {
			return res.status(400).json({ error: 'A catch-up operation is already ongoing' });
		}

		// Parse form
		try {
			const catchupStart = new Date(req.body.catchup_start);
			const catchupEnd = new Date(req.body.catchup_end);
			const catchupLocations = req.body.catchup_locations === 'true';
			const catchupProjects = req.body.catchup_projects === 'true';
			const catchupEvaluations = req.body.catchup_evaluations === 'true';
			const catchupPoolDonations = false; // req.body.catchup_pool_donations === 'true'; (not possible with Intra API)

			catchupOperation.ongoing = true;
			catchupOperation.startDate = catchupStart;
			catchupOperation.endDate = new Date(catchupEnd.getTime() + 1000 * 60 * 60 * 24); // Add one day to the end date to include said date
			catchupOperation.progress = 0;
			catchupOperation.filter.locations = catchupLocations;
			catchupOperation.filter.projects = catchupProjects;
			catchupOperation.filter.evaluations = catchupEvaluations;
			catchupOperation.filter.pool_donations = catchupPoolDonations;
		}
		catch (err) {
			console.error('Failed to parse catchup form:', err);
			return res.status(400).json({ error: 'Failed to parse catchup form' });
		}

		// Start catch-up operations
		startCatchupOperation(catchupOperation, prisma);

		// Respond to the request
		return res.redirect('/admin/hooks/catchup');
	});
};
