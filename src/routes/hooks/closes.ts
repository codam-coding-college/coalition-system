import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WebhookHandledStatus, respondWebHookHandledStatus } from '../hooks';
import { deleteScore, handleFixedPointScore } from '../../handlers/points';

export interface Close {
	id: number;
	reason: string;
	state: string;
	user: {
		id: number;
		login: string;
		// email: string;
		// first_name: string;
		// last_name: string;
		// usual_first_name: string | null;
		// url: string;
		// there's more but we don't care
	}
	kind: string;
	created_at: string;
	updated_at: string;
	community_services: {
		id: number;
		close_id: number;
		tiger_id: number;
		duration: number;
		schedule_at: Date | null;
		occupation: string | null;
		token: string;
		state: string;
		created_at: Date;
		updated_at: Date;
	}[];
	closer: {
		id: number;
		login: string;
		url: string;
	};
};

export const handleCloseWebhook = async function(prisma: PrismaClient, close: Close, res: Response | null = null, webhookDeliveryId: string | null = null): Promise<Response | null> {
	try {
		// Get fixed point type
		const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
			where: {
				type: 'community_service',
			},
		});
		if (!fixedPointType || fixedPointType.point_amount === 0) {
			console.warn("No fixed point type found for community_service or point amount is set to 0, skipping...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}
		if (!close.community_services || close.community_services.length === 0) {
			// Check if previously there were community services attached to this close.
			// If so, the community services were cancelled and we should refund the points taken away.
			const previouslyDeductedPoints = await prisma.codamCoalitionScore.findMany({
				where: {
					fixed_type_id: fixedPointType.type,
					type_intra_id: close.id,
				},
			});
			if (previouslyDeductedPoints && previouslyDeductedPoints.length > 0) {
				// Undo score creation for each previously deducted point
				console.log(`Community services for close ${close.id} were cancelled, refunding previously deducted points...`);
				for (const score of previouslyDeductedPoints) {
					const deleted = await deleteScore(prisma, score.id);
					if (!deleted) {
						console.error(`Failed to delete score ${score.id} for close ${close.id}`);
					}
				}
				return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Ok) : null);
			}
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}

		// Calculate the score
		// For every 2 hours of community service, community_services are deducted
		const totalDuration = close.community_services.reduce((acc, cs) => acc + cs.duration, 0);
		const hoursOfService = totalDuration / 3600;
		const points = Math.floor((hoursOfService / 2) * fixedPointType.point_amount);

		// Create a score
		const score = await handleFixedPointScore(prisma, fixedPointType, close.id, close.user.id, points,
			`Got ${Math.round(hoursOfService)} hours of community service`, new Date(close.created_at));
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
