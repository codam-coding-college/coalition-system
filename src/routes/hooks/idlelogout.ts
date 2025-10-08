import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { WebhookHandledStatus, respondWebHookHandledStatus } from '../hooks';
import { handleFixedPointScore } from '../../handlers/points';

/**
 * Idle Logouts? What are those, you might ask.
 * These are automatic logouts that happen when a user leaves a computer idling too long.
 * This is not implemented in Intra, there is no Intra webhook for this functionality. It needs to be manually implemented in the cluster computers,
 * which should call this webhook when an automatic logout after idling happens.
 *
 * Why would we want to do this?
 * This is to discourage users from leaving computers idling for too long, as it wastes energy and prevents other users from using the computer.
 * Plus, the users would gain points from leaving a computer idling and remaining logged in, as it counts towards their logtime, which is not the intended behavior.
 * This implementation thus punishes users for doing this.
 */

export interface IdleLogout {
	host: string;
	user: {
		id: number;
		login: string;
	},
	logged_out_at: string;
}

export const handleIdleLogoutWebhook = async function(prisma: PrismaClient, autoLogout: IdleLogout, res: Response | null = null, webhookDeliveryId: string | null = null): Promise<Response | null> {
	try {
		// Get fixed point type
		const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
			where: {
				type: 'idle_logout',
			},
		});
		if (!fixedPointType || fixedPointType.point_amount === 0) {
			console.warn("No fixed point type found for idle_logout or point amount is set to 0, skipping...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}

		// Calculate the score
		const loggedOutAt = new Date(autoLogout.logged_out_at);
		const points = fixedPointType.point_amount;

		// Create a score
		const score = await handleFixedPointScore(prisma, fixedPointType, null, autoLogout.user.id, points,
			`Was automatically logged out of ${autoLogout.host} after leaving it idling too long`, loggedOutAt);
		if (!score) {
			console.warn("Refused or failed to create score, skipping...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}
		return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Ok) : null);
	}
	catch (error) {
		console.error("Failed to handle idle_logout close webhook", error);
		return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Error) : null);
	}
};
