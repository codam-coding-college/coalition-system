import Fast42 from '@codam/fast42';
import { prisma } from './base';
import { getBlocAtDate } from '../utils';
import { syncIntraScore, syncTotalCoalitionsScores } from '../handlers/intrascores';

export const syncScores = async function(api: Fast42): Promise<void> {
	// Sync all scores in the ongoing season
	const currentBloc = await getBlocAtDate(prisma, new Date());
	if (!currentBloc) {
		return;
	}

	const scores = await prisma.codamCoalitionScore.findMany({
		where: {
			created_at: {
				gte: currentBloc.begin_at,
				lt: currentBloc.end_at,
			},
			intra_score_id: null,
		},
	});
	let i = 0;
	const total = scores.length;
	for (const score of scores) {
		console.debug(`Syncing Codam coalition score ${++i}/${total} (${score.id})...`);
		await syncIntraScore(prisma, api, score, false);
	}
	await syncTotalCoalitionsScores(prisma, api);
};
