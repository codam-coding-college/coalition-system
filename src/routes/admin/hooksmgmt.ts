import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { CatchupOperation, startCatchupOperation } from '../hooks/catchup';
import { handleWebhook } from '../hooks';

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

	app.get('/admin/hooks/retrigger/:deliveryId', async (req, res) => { // :deliveryId is at the end of the path because the apisearcher requires this
		const deliveryId = req.params.deliveryId;
		const webhook = await prisma.intraWebhook.findUnique({
			where: {
				delivery_id: deliveryId,
			},
		});
		if (!webhook) {
			return res.status(404).json({ error: 'Webhook not found' });
		}
		try {
			await handleWebhook(prisma, webhook.model, JSON.parse(webhook.body), null, deliveryId);
			return res.status(200).json({ status: 'ok' });
		}
		catch (err) {
			console.error('Failed to retrigger webhook:', err);
			return res.status(500).json({ error: 'Failed to retrigger webhook', details: err });
		}
	});

	app.get('/admin/hooks/secrets', async (req, res) => {
		const secrets = await prisma.intraWebhookSecret.findMany();
		return res.render('admin/hooks/secrets.njk', { secrets });
	});

	app.post('/admin/hooks/secrets/:model/:event/edit', async (req, res) => {
		const model = req.params.model;
		const event = req.params.event;
		const secret = req.body.secret;
		const newModel = req.body.new_model;
		const newEvent = req.body.new_event;

		if (!model || !event || !secret || !newModel || !newEvent) {
			return res.status(400).json({ error: 'Missing parameters' });
		}

		await prisma.intraWebhookSecret.update({
			where: {
				model_event: {
					model: model,
					event: event,
				},
			},
			data: {
				model: newModel,
				event: newEvent,
				secret: secret,
			},
		});

		return res.redirect(`/admin/hooks/secrets#secret-${newModel}-${newEvent}`);
	});

	app.post('/admin/hooks/secrets/:model/:event/delete', async (req, res) => {
		const model = req.params.model;
		const event = req.params.event;

		if (!model || !event) {
			return res.status(400).json({ error: 'Missing parameters' });
		}

		const secret = await prisma.intraWebhookSecret.findUnique({
			where: {
				model_event: {
					model: model,
					event: event,
				},
			},
		});

		if (!secret) {
			return res.status(404).json({ error: 'Secret not found' });
		}

		await prisma.intraWebhookSecret.delete({
			where: {
				model_event: {
					model: model,
					event: event,
				},
			},
		});

		return res.redirect('/admin/hooks/secrets');
	});

	app.post('/admin/hooks/secrets/new', async (req, res) => {
		const model = req.body.model;
		const event = req.body.event;
		const secret = req.body.secret;

		if (!model || !event || !secret) {
			return res.status(400).json({ error: 'Missing parameters' });
		}

		await prisma.intraWebhookSecret.create({
			data: {
				event: event,
				model: model,
				secret: secret,
			},
		});

		return res.redirect(`/admin/hooks/secrets#secret-${model}-${event}`);
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
