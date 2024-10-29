import { PrismaClient } from '@prisma/client';
import { Express, Response } from 'express';
import { handleLocationCloseWebhook, Location } from './hooks/locations';
import { handleProjectsUserUpdateWebhook, ProjectUser } from './hooks/projects_users';
import { handleScaleTeamUpdateWebhook, ScaleTeam } from './hooks/scale_teams';
import { handlePointGivenWebhook, PointGiven } from './hooks/pools';

export interface WebhookHeaders {
	modelType: string;
	eventType: string;
	deliveryId: string;
}

export enum WebhookHandledStatus {
	Unhandled = "unhandled",
	Skipped = "skipped",
	Ok = "ok",
	Error = "error",
	AlreadyHandled = "already_handled",
};

export const addWebhookToDB = async function(prisma: PrismaClient, webhookHeaders: WebhookHeaders, body: any): Promise<boolean> {
	// Check if the webhook already exists in our DB
	const existingWebhook = await prisma.intraWebhook.findUnique({
		where: {
			delivery_id: webhookHeaders.deliveryId,
		},
	});
	if (existingWebhook) {
		console.warn(`Webhook ${webhookHeaders.deliveryId} already exists in our database`);
		return false;
	}
	await prisma.intraWebhook.create({
		data: {
			model: webhookHeaders.modelType,
			event: webhookHeaders.eventType,
			delivery_id: webhookHeaders.deliveryId,
			body: JSON.stringify(body),
			received_at: new Date(),
			status: WebhookHandledStatus.Unhandled,
		},
	});
	return true;
};

export const parseWebhookHeaders = function(req: any): WebhookHeaders {
	const modelType = req.headers['x-model'];
	const eventType = req.headers['x-event'];
	const deliveryId = req.headers['x-delivery'];
	return { modelType, eventType, deliveryId };
};

export const respondWebHookHandledStatus = async function(prisma: PrismaClient, deliveryId: string | null, res: Response, status: WebhookHandledStatus): Promise<Response> {
	if (deliveryId) {
		await prisma.intraWebhook.update({
			where: {
				delivery_id: deliveryId,
			},
			data: {
				status: status,
				handled_at: (status !== WebhookHandledStatus.Unhandled ? new Date() : null),
			},
		});
	}
	return res.status(200).json({ status: status }); // Always return 200 OK, we save the webhook in our database anyways and can easily trigger it again from our side
};

export const setupWebhookRoutes = function(app: Express, prisma: PrismaClient): void {
	app.post('/hooks/intra', async (req, res) => {
		// Handle all Intra webhooks
		const webhookHeaders = parseWebhookHeaders(req);
		console.log(`Received ${webhookHeaders.modelType} ${webhookHeaders.eventType} webhook ${webhookHeaders.deliveryId}`, req.body);
		if (!webhookHeaders.deliveryId || !webhookHeaders.modelType || !webhookHeaders.eventType) {
			console.warn('One or more required webhook headers is missing');
			return res.status(400).json({ status: 'error', message: 'One or more required webhook headers is missing' });
		}
		const alreadyHandled = ! await addWebhookToDB(prisma, webhookHeaders, req.body);
		if (alreadyHandled) {
			console.log(`Webhook ${webhookHeaders.deliveryId} already handled, skipping...`);
			return res.status(200).json({ status: WebhookHandledStatus.AlreadyHandled });
		}
		try {
			if (!req.body) {
				throw new Error("Missing body");
			}
			if (typeof req.body !== 'object') {
				throw new Error("Invalid body");
			}
			switch (webhookHeaders.modelType) {
				case "location": // location close
					const location: Location = req.body as Location;
					return await handleLocationCloseWebhook(prisma, location, res, webhookHeaders.deliveryId);
				case "projects_user": // project or exam validation
					const projectUser: ProjectUser = req.body as ProjectUser;
					return await handleProjectsUserUpdateWebhook(prisma, projectUser, res, webhookHeaders.deliveryId);
				case "scale_team": // scale team (evaluation) update
					const scaleTeam: ScaleTeam = req.body as ScaleTeam;
					return await handleScaleTeamUpdateWebhook(prisma, scaleTeam, res, webhookHeaders.deliveryId);
				case "pool": // pool point_given
					const pointGiven: PointGiven = req.body as PointGiven;
					return await handlePointGivenWebhook(prisma, pointGiven, res, webhookHeaders.deliveryId);
				default:
					console.warn("Unknown model type", webhookHeaders.modelType);
					return await respondWebHookHandledStatus(prisma, webhookHeaders.deliveryId, res, WebhookHandledStatus.Error);
			}
		}
		catch (err) {
			console.error("Failed to handle webhook", err);
			return await respondWebHookHandledStatus(prisma, webhookHeaders.deliveryId, res, WebhookHandledStatus.Error);
		}
	});

	app.get('/hooks/status', async (req, res) => {
		return res.status(200).json({ 'status': 'ok' });
	});
};
