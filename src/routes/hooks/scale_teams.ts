import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Fast42 from '@codam/fast42';
import { WebhookHandledStatus, respondWebHookHandledStatus } from '../hooks';
import { handleFixedPointScore } from '../../handlers/points';

export interface ScaleTeam {
	id: number;
	team: { // might not get returned by the student's API
		id: number;
		project_id: number;
		name: string;
		// created_at: string;
		// updated_at: string;
		// locked_at: string | null;
		// closed_at: string | null;
		// final_mark: number | null;
		// repo_url: string | null;
		// deadline_at: string | null;
		// terminating_at: string | null;
		// project_session_id: number;
		// status: string;
	} | undefined;
	flag: {
		id: number;
		name: string;
		positive: boolean;
	};
	comment: string | null;
	feedback_rating: number | null;
	final_mark: number | null;
	user: {
		id: number;
		login: string;
		url: string;
		// there is more but we don't care
	} | undefined; // only defined in webhook (user = corrector)
	corrector: {
		id: number;
		login: string;
		url: string;
	} | "invisible" | undefined; // only defined in API, invisible for students until 15 minutes before the evaluation is scheduled
	begin_at: string;
	filled_at: string | null;
	created_at: string;
	updated_at: string;
	scale: {
		duration: number; // in the API this is specified in seconds, in the webhook it's in 15 minutes blocks
		// don't care about the rest
	};
};

export const handleScaleTeamUpdateWebhook = async function(prisma: PrismaClient, scaleTeam: ScaleTeam, res: Response | null = null, webhookDeliveryId: string | null = null): Promise<Response | null> {
	try {
		if (!scaleTeam.filled_at) {
			console.log("Evaluation not filled yet, skipping...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}

		// Get fixed point type
		const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
			where: {
				type: 'evaluation',
			},
		});
		if (!fixedPointType || fixedPointType.point_amount === 0) {
			console.warn("No fixed point type found for evaluation or point amount is set to 0, skipping...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}

		// Get the user
		const payloadUser = scaleTeam.user || scaleTeam.corrector;
		if (!payloadUser || payloadUser === "invisible") { // can be "invisible" for student API keys until 15 minutes before the evaluation is scheduled
			console.error("No user found in the scale team payload, neither in the user or correcter key", scaleTeam);
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Error) : null);
		}
		if (payloadUser.login === "supervisor") {
			console.warn("User is supervisor, meaning this evaluation was an Internship evaluation done by a company, skipping score creation...");
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}
		const user = await prisma.intraUser.findFirst({
			where: {
				id: payloadUser.id,
			},
		});
		if (!user) {
			console.warn(`User ${payloadUser.id} not found in our database, skipping score creation...`);
			return (res ? respondWebHookHandledStatus(prisma, webhookDeliveryId, res, WebhookHandledStatus.Skipped) : null);
		}

		// Calculate the score
		// Make sure the duration is defined in blocks of 15 minutes (like in the webhook, in the API it's in seconds...)
		const EVALUATION_DEFAULT_DURATION = 900;
		const duration = (scaleTeam.scale.duration > 16 ? scaleTeam.scale.duration / EVALUATION_DEFAULT_DURATION : scaleTeam.scale.duration);
		const points = fixedPointType.point_amount * duration;

		// Create reason
		let reason = `Evaluated`;
		if (scaleTeam.team) {
			// Get the project
			const project = await prisma.intraProject.findFirst({
				where: {
					id: scaleTeam.team.project_id,
				},
			});
			if (project) {
				reason += ` ${project.name} of ${scaleTeam.team.name}`;
			}
			else {
				reason += ` project ID ${scaleTeam.team.project_id} of ${scaleTeam.team.name}`;
			}
		}
		else {
			reason += ` someone`;
		}

		// Create a score
		const filledAt = new Date(scaleTeam.filled_at);
		const score = await handleFixedPointScore(prisma, fixedPointType, scaleTeam.id, user.id, points, reason, filledAt);
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
