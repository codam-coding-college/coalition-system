import { PrismaClient } from '@prisma/client';
import { Express, Response } from 'express';

export interface WebhookHeaders {
	modelType: string;
	eventType: string;
	deliveryId: string;
}

export const markWebhookAsHandled = async function(prisma: PrismaClient, webhookHeaders: WebhookHeaders, body: string): Promise<void> {
	await prisma.intraWebhook.create({
		data: {
			model: webhookHeaders.modelType,
			event: webhookHeaders.eventType,
			delivery_id: webhookHeaders.deliveryId,
			body: body,
			received_at: new Date(),
		},
	});
};

export const parseWebhookHeaders = function(req: any): WebhookHeaders {
	const modelType = req.headers['x-model'];
	const eventType = req.headers['x-event'];
	const deliveryId = req.headers['x-delivery'];
	return { modelType, eventType, deliveryId };
};

export enum WebhookHandledStatus {
	Skipped = "skipped",
	Ok = "ok",
	Error = "error",
};

export const respondWebHookHandledStatus = function(res: Response, status: WebhookHandledStatus): Response {
	return res.status(200).json({ status: status });
};

export const setupWebhookRoutes = function(app: Express, prisma: PrismaClient): void {


	app.get('/hooks', async (req, res) => {
		return res.status(200).json({ 'status': 'ok' });
	});
};
