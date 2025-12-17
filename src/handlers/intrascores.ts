import { CodamCoalitionScore, IntraCoalition, PrismaClient } from '@prisma/client';
import Fast42 from '@codam/fast42';
import { getBlocAtDate, getCoalitionScore, scoreBelongsToBloc } from '../utils';
import { fetchSingle42ApiPage } from '../sync/base';
import { CAMPUS_ID, CURSUS_ID } from '../env';

export const intraScoreSyncingPossible = async function(prisma: PrismaClient, score: CodamCoalitionScore | null): Promise<boolean> {
	// Intra scores can only be created in the present, not in the past, so we only care about scores
	// that belong to the currently ongoing season.

	// Check if we're running in production
	if (process.env.NODE_ENV !== 'production') {
		return false;
	}

	// Check if there is an ongoing season
	const currentBloc = await getBlocAtDate(prisma, new Date());
	if (!currentBloc) {
		return false;
	}

	// Check if a score is included
	if (score) {
		// Check if it belongs to the currently ongoing season
		if (!scoreBelongsToBloc(score, currentBloc)) {
			return false;
		}
	}
	return true;
};

export const deleteIntraScore = async function(prisma: PrismaClient, api: Fast42, score: CodamCoalitionScore): Promise<void> {
	if (!score.intra_score_id) {
		return;
	}
	console.log(`Deleting Intra score ${score.intra_score_id}...`);
	const del = await api.delete(`/coalitions/${score.coalition_id}/scores/${score.intra_score_id}`, {});
	if (del.ok) {
		console.log('Intra score deleted, updating Codam coalition score...');
		await prisma.codamCoalitionScore.update({
			where: {
				id: score.id,
			},
			data: {
				intra_score_id: null,
			},
		});
	}
	else {
		console.warn(`Failed to delete Intra score, HTTP status ${del.status} ${del.statusText}`);
	}
};

const createIntraScore = async function(prisma: PrismaClient, api: Fast42, score: CodamCoalitionScore): Promise<number> {
	console.log(`Creating Intra score for Codam score ${score.id}...`);
	const coalitionUser = await prisma.intraCoalitionUser.findFirst({
		where: {
			user_id: score.user_id,
		},
	});
	if (!coalitionUser) {
		throw new Error('No coalition user found for user.');
	}

	const post = await api.post(`/coalitions/${score.coalition_id}/scores`, {
		"score": {
			"reason": `[CCS-${CAMPUS_ID}-${CURSUS_ID}-${score.id}] ${score.reason}`,
			"value": score.amount,
			"coalitions_user_id": coalitionUser.id,
			"scoreable_type": null, // Could set this to something based on the fixed_type_id, but in the end
			"scoreable_id": null, // the connection to Intra is more of a backwards-compatibility thing, so we don't care.
			"calculation_id": null, // We also don't care about this. We do the calculation, not Intra.
		}
	});
	if (!post.ok) {
		throw new Error(`Failed to create Intra score for CodamCoalitionScore ${score.id}, HTTP status ${post.status} ${post.statusText}`);
	}
	try {
		const postBody = await post.json();
		console.log(`Intra score created, id ${postBody.id}. Updating Codam coalition score...`);
		// Check if a score was created in the meantime due to multithreading
		const currentIntraScoreId = await prisma.codamCoalitionScore.findFirst({
			where: {
				id: score.id,
			},
			select: {
				intra_score_id: true,
			},
		});
		if (currentIntraScoreId && currentIntraScoreId.intra_score_id != null) {
			console.warn(`Two Intra scores were simultaneously created (probably due to multithreading) for score ${score.id}. Deleting duplicate Intra score ${postBody.id}...`);
			const del = await api.delete(`/coalitions/${score.coalition_id}/scores/${postBody.id}`, {});
			if (!del.ok) {
				throw new Error(`Failed to delete duplicate Intra score ${postBody.id}`);
			}
			return currentIntraScoreId.intra_score_id; // Return with the previously created Intra score
		}
		await prisma.codamCoalitionScore.update({
			where: {
				id: score.id,
			},
			data: {
				intra_score_id: postBody.id,
			},
		});
		return postBody.id; // return the Intra score ID
	}
	catch (err) {
		console.error(`Failed to process Intra score creation. The Intra score will be deleted again. Error:`, err);
		await deleteIntraScore(prisma, api, score);
		throw err;
	}
};

export const syncTotalCoalitionScore = async function(prisma: PrismaClient, api: Fast42, coalition: IntraCoalition): Promise<void> {
	if (! await intraScoreSyncingPossible(prisma, null)) {
		throw new Error('Intra score syncing not possible for this score.');
	}
	const currentScore = await getCoalitionScore(prisma, coalition.id, new Date());
	const intraCoalition = await fetchSingle42ApiPage(api, `/coalitions/${coalition.id}`, {});
	const scoreOnIntra = intraCoalition.score;
	if (currentScore.score !== scoreOnIntra) {
		console.log(`Averaging out the Intra score for coalition ${coalition.id} (${coalition.name}) from ${scoreOnIntra} to ${currentScore.score}...`);
		const diff = currentScore.score - scoreOnIntra;
		if (diff > 0) {
			console.warn(`Intra score is lower than Codam score, this should not happen! We will continue to sync the score, but it is very likely some user's scores are not synced to Intra.`);
		}
		const sync = await api.post(`/coalitions/${coalition.id}/scores`, {
			"score": {
				"reason": `[CCS-${CAMPUS_ID}-${CURSUS_ID}-sync] Averaging ${coalition.name}'s total score`,
				"value": diff,
				"coalitions_user_id": null, // Do not link this score to a user
			}
		});
		if (!sync.ok) {
			throw new Error(`Failed to sync total coalition score, HTTP status ${sync.status} ${sync.statusText}`);
		}
		console.log(`Total coalition score for coalition ${coalition.id} (${coalition.name}) synced.`);
	}
};

export const syncTotalCoalitionsScores = async function(prisma: PrismaClient, api: Fast42): Promise<void> {
	if (! await intraScoreSyncingPossible(prisma, null)) {
		throw new Error('Intra score syncing not possible for this score.');
	}
	const coalitions = await prisma.intraCoalition.findMany({});
	for (const coalition of coalitions) {
		await syncTotalCoalitionScore(prisma, api, coalition);
	}
};

export const syncIntraScore = async function(prisma: PrismaClient, api: Fast42, score: CodamCoalitionScore, doTotalSync: boolean = true): Promise<number> {
	if (! await intraScoreSyncingPossible(prisma, score)) {
		throw new Error('Intra score syncing not possible for this score.');
	}

	// No way to patch coalition scores, so we delete and recreate them.
	if (score.intra_score_id) {
		await deleteIntraScore(prisma, api, score);
	}
	const scoreId = await createIntraScore(prisma, api, score);
	if (doTotalSync) {
		const coalition = await prisma.intraCoalition.findFirst({
			where: {
				id: score.coalition_id,
			},
		});
		await syncTotalCoalitionScore(prisma, api, coalition!);
	}
	return scoreId;
};
