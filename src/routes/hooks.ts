import { PrismaClient } from '@prisma/client';
import { Express, Response } from 'express';
import { handleLocationCloseWebhook, Location } from './hooks/locations';
import { handleIdleLogoutWebhook, IdleLogout } from './hooks/idlelogout';
import { handleProjectsUserUpdateWebhook, ProjectUser } from './hooks/projects_users';
import { handleScaleTeamUpdateWebhook, ScaleTeam } from './hooks/scale_teams';
import { handlePointGivenWebhook, PointGiven } from './hooks/pools';

export interface WebhookHeaders {
	modelType: string;
	eventType: string;
	deliveryId: string;
	secret: string;
}

export enum WebhookHandledStatus {
	Unhandled = "unhandled",
	Skipped = "skipped",
	Ok = "ok",
	Error = "error",
	AlreadyHandled = "already_handled",
	SecretConfigMissing = "secret_config_missing",
	IncorrectSecret = "incorrect_secret",
};

export const addWebhookToDB = async function(prisma: PrismaClient, webhookHeaders: WebhookHeaders, body: any): Promise<WebhookHandledStatus> {
	// Check if the webhook already exists in our DB
	const existingWebhook = await prisma.intraWebhook.findUnique({
		where: {
			delivery_id: webhookHeaders.deliveryId,
		},
	});
	if (existingWebhook) {
		console.warn(`Webhook ${webhookHeaders.deliveryId} already exists in our database`);
		return existingWebhook.status as WebhookHandledStatus;
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
	return WebhookHandledStatus.Unhandled;
};

export const parseWebhookHeaders = function(req: any): WebhookHeaders {
	const modelType = req.headers['x-model'];
	const eventType = req.headers['x-event'];
	const deliveryId = req.headers['x-delivery'];
	const secret = req.headers['x-secret'];
	return { modelType, eventType, deliveryId, secret };
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

export const handleWebhook = async function(prisma: PrismaClient, modelType: string, body: { [key: string]: any }, res: Response | null, deliveryId: string): Promise<Response<any, Record<string, any>> | null> {
	if (!body) {
		throw new Error("Missing body");
	}
	if (typeof body !== 'object') {
		throw new Error("Invalid body");
	}
	switch (modelType) {
		case "location": // location close
			const location: Location = body as Location;
			return await handleLocationCloseWebhook(prisma, location, res, deliveryId);
		case "idle_logout": // idle logout
			const autoLogout: IdleLogout = body as IdleLogout;
			return await handleIdleLogoutWebhook(prisma, autoLogout, res, deliveryId);
		case "projects_user": // project or exam validation
			const projectUser: ProjectUser = body as ProjectUser;
			return await handleProjectsUserUpdateWebhook(prisma, projectUser, res, deliveryId);
		case "scale_team": // scale team (evaluation) update
			const scaleTeam: ScaleTeam = body as ScaleTeam;
			return await handleScaleTeamUpdateWebhook(prisma, scaleTeam, res, deliveryId);
		case "pool": // pool point_given
			const pointGiven: PointGiven = body as PointGiven;
			return await handlePointGivenWebhook(prisma, pointGiven, res, deliveryId);
		default:
			console.warn("Unknown model type", modelType);
			return await (res ? respondWebHookHandledStatus(prisma, deliveryId, res, WebhookHandledStatus.Error) : null);
	}
};

export const setupWebhookRoutes = function(app: Express, prisma: PrismaClient): void {
	app.post('/hooks/intra', async (req, res) => {
		// Handle all Intra webhooks
		const webhookHeaders: WebhookHeaders = parseWebhookHeaders(req);
		console.log(`Received ${webhookHeaders.modelType} ${webhookHeaders.eventType} webhook ${webhookHeaders.deliveryId}`, req.body);
		if (!webhookHeaders.deliveryId || !webhookHeaders.modelType || !webhookHeaders.eventType) {
			console.warn('One or more required webhook headers is missing');
			return res.status(400).json({ status: 'error', message: 'One or more required webhook headers is missing' });
		}

		// Add the webhook to our database to keep track of how the webhook was handled
		const webhookHandledStatus = await addWebhookToDB(prisma, webhookHeaders, req.body);
		if (webhookHandledStatus == WebhookHandledStatus.Ok || webhookHandledStatus == WebhookHandledStatus.Skipped) {
			console.log(`Webhook ${webhookHeaders.deliveryId} already handled, skipping...`);
			return res.status(200).json({ status: WebhookHandledStatus.AlreadyHandled });
		}

		// Verify the webhook secret
		const expectedSecret = await prisma.intraWebhookSecret.findUnique({
			where: {
				model_event: {
					model: webhookHeaders.modelType,
					event: webhookHeaders.eventType,
				},
			},
		});
		if (!expectedSecret) {
			console.warn(`Secret config missing for webhook of type ${webhookHeaders.modelType} ${webhookHeaders.eventType}! Add it using the admin interface.`);
			return await respondWebHookHandledStatus(prisma, webhookHeaders.deliveryId, res, WebhookHandledStatus.SecretConfigMissing);
		}
		if (expectedSecret.secret !== webhookHeaders.secret) {
			console.warn(`Incorrect secret received for webhook of type ${webhookHeaders.modelType} ${webhookHeaders.eventType} from ip ${req.ip}!`);
			return await respondWebHookHandledStatus(prisma, webhookHeaders.deliveryId, res, WebhookHandledStatus.IncorrectSecret);
		}

		// Actually handle the webhook, but do catch any errors
		try {
			return handleWebhook(prisma, webhookHeaders.modelType, req.body, res, webhookHeaders.deliveryId);
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
