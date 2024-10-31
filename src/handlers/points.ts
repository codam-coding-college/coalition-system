import { CodamCoalitionFixedType, CodamCoalitionScore, PrismaClient } from '@prisma/client';

export const createScore = async function(prisma: PrismaClient, type: CodamCoalitionFixedType, typeIntraId: number | null, userId: number, points: number, reason: string, scoreDate: Date = new Date()): Promise<CodamCoalitionScore | null> {
	// Get the user's coalition
	const coalitionUser = await prisma.intraCoalitionUser.findFirst({
		where: {
			user_id: userId,
		},
	});

	if (!coalitionUser) {
		console.warn(`User ${userId} does not have a coalition, skipping score creation...`);
		return null;
	}

	console.log(`Creating score for user ${userId} in coalition ${coalitionUser.coalition_id} with ${points} points for reason "${reason}" (connected to Intra object ${typeIntraId} for fixed type ${type.type})...`);
	return await prisma.codamCoalitionScore.create({
		data: {
			amount: points,
			fixed_type_id: type.type,
			type_intra_id: typeIntraId,
			user_id: userId,
			coalition_id: coalitionUser.coalition_id,
			reason: reason,
			created_at: scoreDate,
		},
	});

	// TODO: create intra score (maybe not here but in a runner/job?)
}

export const updateScore = async function(prisma: PrismaClient, score: CodamCoalitionScore, new_score: number, reason: string): Promise<CodamCoalitionScore> {
	console.log(`Updating CodamScore ${score.id} of ${score.user_id} of coalition ${score.coalition_id} with new amount ${new_score}...`);
	await prisma.codamCoalitionScore.update({
		where: {
			id: score.id,
		},
		data: {
			amount: new_score,
			updated_at: new Date(),
			reason: reason,
		}
	});

	// TODO: update intra score (maybe not here but in a runner/job?)

	return await prisma.codamCoalitionScore.findFirstOrThrow({
		where: {
			id: score.id,
		},
	});
}

export const handleFixedPointScore = async function(prisma: PrismaClient, type: CodamCoalitionFixedType, typeIntraId: number | null, userId: number, points: number, reason: string, scoreDate: Date = new Date()): Promise<CodamCoalitionScore | null> {
	if (typeIntraId) {
		// Check if a score already exists for this type and typeIntraId
		const existingScore = await prisma.codamCoalitionScore.findFirst({
			where: {
				fixed_type_id: type.type,
				type_intra_id: typeIntraId,
			},
		});

		if (existingScore) {
			// Update the existing score
			console.warn(`Score already exists for type ${type.type} and typeIntraId ${typeIntraId}, updating CodamScore ${existingScore.id} with IntraScore ${existingScore.intra_score_id}...`);
			// TODO: delete the score if the coalitionsUser does not exist
			// Do not delete if the score is 0, or you can no longer recalculate the score later on!
			return await updateScore(prisma, existingScore, points, reason);
		}
	}

	// Create a new score
	return await createScore(prisma, type, typeIntraId, userId, points, reason, scoreDate);
};
