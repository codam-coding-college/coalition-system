import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WebhookHandledStatus, respondWebHookHandledStatus } from '../hooks';
import { handleFixedPointScore } from '../../handlers/points';

export interface PointGiven {
	id: number;
	campus_id: number;
	cursus_id: number;
	given_by: {
		id: number;
		first_name: string;
		last_name: string;
		usual_first_name: string | null;
		email: string;
		login: string;
		correction_points: number;
	} | null;
	points: {
		old: number;
		current: number;
	},
	max_points: number;
};

export const handlePointGivenWebhook = async function(prisma: PrismaClient, pointGiven: PointGiven, res: Response | null = null, webhookDeliveryId: string | null = null): Promise<Response | null> {
	try {
		// Get fixed point type
		const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
			where: {
				type: 'point_donated',
			},
		});
		if (!fixedPointType || fixedPointType.point_amount === 0) {
			console.warn("No fixed point type found for point_donated or point amount is set to 0, skipping...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}
		if (!pointGiven.given_by) {
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}

		// Calculate the score
		const actualPointsGiven = pointGiven.points.current - pointGiven.points.old;
		const points = actualPointsGiven * fixedPointType.point_amount;

		// Create a score
		const score = await handleFixedPointScore(prisma, fixedPointType, null, pointGiven.given_by.id, points,
			`Donated ${actualPointsGiven} eval point${actualPointsGiven !== 1 ? 's' : ''} to the pool`);
		if (!score) {
			console.warn("Refused or failed to create score, skipping...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}
		return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Ok) : null);
	}
	catch (error) {
		console.error("Failed to handle pool point_given webhook", error);
		return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Error) : null);
	}
};
