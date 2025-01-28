import { Response } from 'express';
import { CodamCoalitionFixedType, PrismaClient } from '@prisma/client';
import Fast42 from '@codam/fast42';
import { WebhookHandledStatus, respondWebHookHandledStatus } from '../hooks';
import { handleFixedPointScore } from '../../handlers/points';

export interface ProjectUser {
	id: number;
	project_id: number | undefined; // only defined in webhook
	project: {
		id: number;
		name: string;
		slug: string;
		parent_id: number | null;
	} | undefined; // only defined in API
	user_id: number | undefined; // only defined in webhook
	user: {
		id: number;
		login: string;
		url: string;
	} | undefined; // only defined in API
	current_team_id: number | null;
	occurrence: number
	final_mark: number | null;
	status: string;
	retriable_at: Date | null;
	marked_at: Date | null;
	'validated?': boolean;
	created_at: Date;
	updated_at: Date;
};

// Handle project and exam validation
export const handleProjectsUserUpdateWebhook = async function(prisma: PrismaClient, projectUser: ProjectUser, res: Response | null = null, webhookDeliveryId: string | null = null): Promise<Response | null> {
	try {

		if (projectUser.status !== 'finished' || !projectUser['validated?'] || projectUser.final_mark === null || projectUser.final_mark < 0 || projectUser.marked_at === null) {
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}

		// Get the project
		const projectId = projectUser.project_id || (projectUser.project ? projectUser.project.id : undefined);
		if (!projectId) { // a value of undefined is treated as the value not being there at all by Prisma, so catch it here
			console.warn("No project ID found in the projectUser data, skipping score creation...", projectUser);
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}
		const project = await prisma.intraProject.findFirst({
			where: {
				id: projectId,
			},
		});
		if (!project) {
			console.warn(`Project ${projectId} not found in our database, skipping score creation...`);
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}

		let fixedPointType: CodamCoalitionFixedType | null = null;
		let points = 0;
		if (project.exam) {
			// Special case for exams, they have a fixed point amount and the score + difficulty is not taken into account
			fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
				where: {
					type: 'exam',
				},
			});
			if (!fixedPointType || fixedPointType.point_amount === 0) {
				console.warn("No fixed point type found for exam or point amount is set to 0, skipping...");
				return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
			}

			// "Calculate" the score based on the fixed point type for exams
			points = fixedPointType.point_amount;
		}
		else {
			// Get the project difficulty
			if (project.difficulty === 0 || project.difficulty === null) {
				console.log(`Project ${projectId} has no difficulty set, skipping score creation...`);
				return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
			}

			// Get fixed point type
			fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
				where: {
					type: 'project',
				},
			});
			if (!fixedPointType || fixedPointType.point_amount === 0) {
				console.warn("No fixed point type found for project or point amount is set to 0, skipping...");
				return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
			}

			// Calculate the score based on the fixed point type for projects
			// score = (mark * i) + (difficulty * (mark / 100) / i^1.25)
			points = (projectUser.final_mark * fixedPointType.point_amount) + (project.difficulty * (projectUser.final_mark / 100) / Math.pow(fixedPointType.point_amount, 1.25));
		}

		// Create a score
		const userId = projectUser.user_id || (projectUser.user ? projectUser.user.id : undefined);
		if (!userId) {
			console.warn("No user ID found in the projectUser data, skipping score creation...", projectUser);
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}
		const updatedAt = new Date(projectUser.updated_at); // Could use markedAt, but the updated_at is more reliable (marked_at can be months ago if the evaluation feedback was filled in months after the project was marked)
		const score = await handleFixedPointScore(prisma, fixedPointType, projectUser.id, userId, points,
			`Validated ${project.name} with ${projectUser.final_mark}%`, updatedAt);
		if (!score) {
			console.warn("Refused or failed to create score, skipping...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}
		return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Ok) : null);
	}
	catch (error) {
		console.error("Failed to handle projects_user update webhook", error);
		return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Error) : null);
	}
};
