import { CodamCoalitionFixedType, CodamCoalitionScore, PrismaClient } from '@prisma/client';
import { CURSUS_ID, INTRA_TEST_ACCOUNTS } from '../env';
import { syncIntraScore } from './intrascores';
import { getAPIClient, getBlocAtDate } from '../utils';
import { generateChartAllCoalitionScoreHistory, generateChartCoalitionScoreHistory } from '../routes/charts';
import { triggerSSE } from '../routes/sse';

const INCLUDE_IN_SCORE_RETURN_DATA = {
	user: {
		include: {
			intra_user: true,
		},
	},
	coalition: {
		include: {
			intra_coalition: true,
		},
	},
};

export const createScore = async function(prisma: PrismaClient, type: CodamCoalitionFixedType | null, typeIntraId: number | null, userId: number, points: number, reason: string, scoreDate: Date = new Date(), syncWithIntra: boolean = true): Promise<CodamCoalitionScore | null> {
	// Retrieve user details
	const user = await prisma.intraUser.findFirst({
		where: {
			id: userId,
		},
		select: {
			login: true,
			kind: true,
			coalition_users: {
				select: {
					coalition_id: true,
				},
			},
			cursus_users: {
				where: { // only get active cursus_users for the relevant cursus
					AND: [
						{
							cursus_id: CURSUS_ID,
						},
						{
							OR: [
								{ end_at: null },
								{ end_at: { gt: scoreDate } }, // also consider cursus_users that were still active at the score creation date
							],
						},
					],
				},
				select: {
					id: true,
				},
			},
		},
	});
	if (!user) { // Check if user exists
		console.error(`User ${userId} does not exist in our database, skipping score creation...`);
		return null;
	}
	if (user.kind === "admin") { // Check if user is a staff member
		console.warn(`User ${user.login} is an admin (staff member), skipping score creation...`);
		return null;
	}
	if (INTRA_TEST_ACCOUNTS.includes(user.login)) { // Check if user is a testing account used by campus staff
		console.warn(`User ${user.login} is a test account, skipping score creation...`);
		return null;
	}
	if (!user.cursus_users || user.cursus_users.length === 0) { // Check if user has an active cursus in the cursus id the coalition system is running for
		console.warn(`User ${userId} does not have an active cursus in cursus id ${CURSUS_ID}, skipping score creation...`);
		return null;
	}
	const blocAtScoreCreation = await getBlocAtDate(prisma, scoreDate);
	const currentBloc = await getBlocAtDate(prisma, new Date());
	if (blocAtScoreCreation && currentBloc && blocAtScoreCreation.id !== currentBloc.id) { // Check if the score creation date is in the current bloc if a current bloc and previous bloc exist (if not, just assign the score - it won't belong to any season but it can be shifted using the admin panel)
		console.warn(`Score creation date ${scoreDate} is not in the current bloc ${currentBloc.id} (${currentBloc.begin_at} - ${currentBloc.end_at}) but in bloc ${blocAtScoreCreation.id} (${blocAtScoreCreation.begin_at} - ${blocAtScoreCreation.end_at}), skipping score creation...`);
		return null;
	}
	if (!blocAtScoreCreation) { // Check if there is a season ongoing at the score creation date
		console.warn(`No bloc found for score creation date ${scoreDate}. The score will be created, but will not belong to any season. It should be shifted later to the correct season using the admin panel.`);
	}
	if (!user.coalition_users || user.coalition_users.length === 0) { // Check if user has a coalition
		console.warn(`User ${userId} does not have a coalition, skipping score creation...`);
		return null;
	}
	const coalitionUser = user.coalition_users[0];

	console.log(`Creating score for user ${userId} in coalition ${coalitionUser.coalition_id} with ${points} points for reason "${reason}" (connected to Intra object ${typeIntraId} for fixed type ${(type ? type.type : "null")}), at score creation date ${scoreDate.toISOString()}...`);
	const score = await prisma.codamCoalitionScore.create({
		data: {
			amount: points,
			fixed_type_id: (type ? type.type : null),
			type_intra_id: typeIntraId,
			user_id: userId,
			coalition_id: coalitionUser.coalition_id,
			reason: reason,
			created_at: scoreDate,
		},
		include: INCLUDE_IN_SCORE_RETURN_DATA,
	});

	// Send SSE to any connected clients to notify them of the new score
	triggerSSE('scores', 'new_score', score);

	// Start caching updated charts, but don't wait for that to finish
	try {
		generateChartAllCoalitionScoreHistory(prisma, true);
		generateChartCoalitionScoreHistory(prisma, coalitionUser.coalition_id, true);
	}
	catch (err) {
		console.error(`Failed to generate charts for Codam score ${score.id}. Error:`, err);
	}

	if (syncWithIntra && process.env.NODE_ENV === 'production') {
		const api = await getAPIClient();
		try {
			score.intra_score_id = await syncIntraScore(prisma, api, score, true); // Sync the score with Intra
		}
		catch (err) {
			console.error(`Failed to sync Intra score for Codam score ${score.id}. Error:`, err);
		}
	}

	return score;
}

export const shiftScore = async function(prisma: PrismaClient, scoreId: number, newCreationDate: Date): Promise<CodamCoalitionScore> {
	console.log(`Shifting CodamScore ${scoreId} to new creation date ${newCreationDate}...`);
	const score = await prisma.codamCoalitionScore.update({
		where: {
			id: scoreId,
		},
		data: {
			created_at: newCreationDate,
			updated_at: new Date(),
		}
	});

	const api = await getAPIClient();
	await syncIntraScore(prisma, api, score, false); // Sync this score but not the total coalition score, as we often move many points at once when shifting scores. Better to sync the total score once at the end.

	// Start caching updated charts, but don't wait for that to finish
	try {
		generateChartAllCoalitionScoreHistory(prisma, true);
		generateChartCoalitionScoreHistory(prisma, score.coalition_id, true);
	}
	catch (err) {
		console.error(`Failed to generate charts for Codam score ${score.id}. Error:`, err);
	}

	return score;
}

export const handleFixedPointScore = async function(prisma: PrismaClient, type: CodamCoalitionFixedType, typeIntraId: number | null, userId: number, points: number, reason: string, scoreDate: Date = new Date()): Promise<CodamCoalitionScore | null> {
	if (typeIntraId) {
		// Check if a score already exists for this type and typeIntraId
		const existingScores = await prisma.codamCoalitionScore.aggregate({
			_sum: {
				amount: true, // Sum the previous scores if there were more than one (e.g. 3 retries on a project)
			},
			where: {
				user_id: userId, // This means that if we PATCH an Intra object in the Intra API, changing which user the object belongs to, a score could show up more than once, while the old score should be deleted. But when does this ever happen?
				fixed_type_id: type.type,
				type_intra_id: typeIntraId,
			},
		});

		if (existingScores._sum.amount !== null) {
			// Score(s) were already given for this type and typeIntraId in the past,
			// so this call is a retry. Compute the point difference against the
			// historical total and:
			//   - hand out the difference when the user earned more points than before;
			//   - record a 0-point row when the user did equally well or worse, so
			//     the retry stays visible on the user's profile without ever
			//     deducting points (a negative diff usually means the scoring
			//     config -- point_amount, project.difficulty, ... -- changed since
			//     the original row was written, and we should not punish a user for
			//     re-evaluating something they had already passed).
			const pointDifference = Math.floor(points) - existingScores._sum.amount;
			if (pointDifference < -10) {
				console.warn(`Score(s) already exist for type ${type.type} and typeIntraId ${typeIntraId}. Recomputed points (${Math.floor(points)}) are ${-pointDifference} below the existing total (${existingScores._sum.amount}); clamping to 0 to avoid taking points away on a retry. This usually indicates the scoring config has changed since the original score was awarded.`);
			}
			const awardedPoints = pointDifference > 0 ? pointDifference : 0;
			// Relabel the reason so the score history makes it clear this row
			// represents a retry, not a first-time validation.
			const retryReason = reason.startsWith('Validated ')
				? `Retried ${reason.slice('Validated '.length)}`
				: `Retried: ${reason}`;
			console.log(`Score(s) already exist for type ${type.type} and typeIntraId ${typeIntraId}. Point difference is ${pointDifference}, recording retry as ${awardedPoints} point(s)...`);
			// Skip the Intra sync for 0-point audit rows: they don't change the
			// coalition total and would just add noise on Intra.
			return await createScore(prisma, type, typeIntraId, userId, awardedPoints, retryReason, scoreDate, awardedPoints !== 0);
		}
	}

	// Create a new score
	return await createScore(prisma, type, typeIntraId, userId, points, reason, scoreDate);
};
