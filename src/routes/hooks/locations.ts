import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WebhookHandledStatus, respondWebHookHandledStatus } from '../hooks';
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

export const handleLocationCloseWebhook = async function(prisma: PrismaClient, location: Location, res: Response | null = null, webhookDeliveryId: string | null = null): Promise<Response | null> {
	try {
		// Get fixed point type
		const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
			where: {
				type: 'logtime',
			},
		});
		if (!fixedPointType || fixedPointType.point_amount === 0) {
			console.warn("No fixed point type found for logtime or point amount is set to 0, skipping...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}

		// Calculate the score
		const beginAt = new Date(location.begin_at);
		const endAt = new Date(location.end_at);
		const duration = (endAt.getTime() - beginAt.getTime()) / 1000 / 3600;
		const points = Math.floor(duration * fixedPointType.point_amount);

		// Create a score
		const score = await handleFixedPointScore(prisma, fixedPointType, location.id, location.user.id, points,
			`Logged ${duration.toFixed(1)} hours at ${location.host}`, endAt);
		if (!score) {
			console.warn("Refused or failed to create score, skipping...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}
		return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Ok) : null);
	}
	catch (error) {
		console.error("Failed to handle location close webhook", error);
		return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Error) : null);
	}
};
