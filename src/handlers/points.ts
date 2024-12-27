import { CodamCoalitionFixedType, CodamCoalitionScore, PrismaClient } from '@prisma/client';
import { INTRA_TEST_ACCOUNTS } from '../env';
import { syncIntraScore } from './intrascores';
import Fast42 from '@codam/fast42';
import { getAPIClient } from '../utils';

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
		}
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
	if (!user.coalition_users || user.coalition_users.length === 0) { // Check if user has a coalition
		console.warn(`User ${userId} does not have a coalition, skipping score creation...`);
		return null;
	}
	const coalitionUser = user.coalition_users[0];

	console.log(`Creating score for user ${userId} in coalition ${coalitionUser.coalition_id} with ${points} points for reason "${reason}" (connected to Intra object ${typeIntraId} for fixed type ${(type ? type.type : "null")})...`);
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
	if (syncWithIntra) {
		const api = await getAPIClient();
		score.intra_score_id = await syncIntraScore(prisma, api, score, true); // Sync the score with Intra
	}
	return score;
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

	const api = await getAPIClient();
	await syncIntraScore(prisma, api, score, true);

	return await prisma.codamCoalitionScore.findFirstOrThrow({
		where: {
			id: score.id,
		},
		include: INCLUDE_IN_SCORE_RETURN_DATA,
	});
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

	return score;
}

export const handleFixedPointScore = async function(prisma: PrismaClient, type: CodamCoalitionFixedType, typeIntraId: number | null, userId: number, points: number, reason: string, scoreDate: Date = new Date()): Promise<CodamCoalitionScore | null> {
	if (typeIntraId) {
		// Check if a score already exists for this type and typeIntraId
		const existingScore = await prisma.codamCoalitionScore.findFirst({
			where: {
				user_id: userId, // This means that if we PATCH an Intra object in the Intra API, changing which user the object belongs to, a score could show up more than once, while the old score should be deleted. But when does this ever happen?
				fixed_type_id: type.type,
				type_intra_id: typeIntraId,
			},
		});

		if (existingScore) {
			// Update the existing score
			console.warn(`Score already exists for type ${type.type}, user ${userId} and typeIntraId ${typeIntraId}, updating this existing CodamScore ${existingScore.id} with IntraScore ${existingScore.intra_score_id}...`);
			// TODO: delete the score if the coalitionsUser does not exist
			// Do not delete if the score is 0, or you can no longer recalculate the score later on!
			return await updateScore(prisma, existingScore, points, reason);
		}
	}

	// Create a new score
	return await createScore(prisma, type, typeIntraId, userId, points, reason, scoreDate);
};
