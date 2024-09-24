import { Express, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WebhookHandledStatus, WebhookHeaders, markWebhookAsHandled, parseWebhookHeaders, respondWebHookHandledStatus } from '../hooks';
import { handleFixedPointScore } from '../../handlers/points';

export interface Location {
	id: number;
	begin_at: string;
	end_at: string;
	primary: boolean;
	host: string;
	campus_id: number;
	user: {
		id: number;
		login: string;
		url: string;
	};
};

export const handleLocationCloseWebhook = async function(prisma: PrismaClient, webhookHeaders: WebhookHeaders, location: Location, res: Response | null = null): Promise<Response | null> {
	// Get fixed point type
	const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
		where: {
			type: 'logtime',
		},
	});
	if (!fixedPointType) {
		console.warn("No fixed point type found for logtime, skipping...");
		return (res ? respondWebHookHandledStatus(res, WebhookHandledStatus.Skipped) : null);
	}

	// Calculate the score
	const beginAt = new Date(location.begin_at);
	const endAt = new Date(location.end_at);
	const duration = (endAt.getTime() - beginAt.getTime()) / 1000 / 3600;
	const points = Math.floor(duration * fixedPointType.point_amount);

	// Create a score
	const score = await handleFixedPointScore(prisma, fixedPointType, location.id, location.user.id,
		points, `Logged ${duration.toFixed(1)} hours at ${location.host}`);
	if (!score) {
		console.warn("Refused or failed to create score, skipping...");
		return (res ? respondWebHookHandledStatus(res, WebhookHandledStatus.Skipped) : null);
	}
	return (res ? respondWebHookHandledStatus(res, WebhookHandledStatus.Ok) : null);
};

export const setupWebhookLocations = function(app: Express, prisma: PrismaClient): void {
	app.get('/hooks/locations', async (req, res) => {
		try {
			const webhookHeaders = parseWebhookHeaders(req);
			const location: Location = JSON.parse(req.body);
			console.log("Received location webhook", location);
			await markWebhookAsHandled(prisma, webhookHeaders, req.body);

			return await handleLocationCloseWebhook(prisma, webhookHeaders, location, res);
		}
		catch (err) {
			console.log("Error in location webhook", err);
			return res.status(500).json({ error: err });
		}
	});
}
