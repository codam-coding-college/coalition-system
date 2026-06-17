import { prisma } from '../handlers/db';

// Idempotently creates the "Top Contributors" ranking WITHOUT touching any of the other
// ranking definitions. Safe to run on an existing database (unlike create_rankings.ts,
// which deletes and recreates ALL rankings).
const RANKING_TYPE = 'top_contributors';

const createContributorsRanking = async function(): Promise<void> {
	// Make sure the contribution fixed point type exists (created on application startup)
	const contributionType = await prisma.codamCoalitionFixedType.findFirst({
		where: {
			type: 'contribution',
		},
	});
	if (!contributionType) {
		throw new Error("The 'contribution' fixed point type does not exist yet. Start the application at least once before running this script.");
	}

	const existing = await prisma.codamCoalitionRanking.findFirst({
		where: {
			type: RANKING_TYPE,
		},
	});
	if (existing) {
		console.log(`The '${RANKING_TYPE}' ranking already exists, nothing to do.`);
		return;
	}

	await prisma.codamCoalitionRanking.create({
		data: {
			type: RANKING_TYPE,
			name: 'Top Contributors',
			description: 'Based on points gained through contributing to Codam\'s open source projects',
			top_title: 'Top Contributor %login',
			bonus_points: 0,
			disabled: false,
			fixed_types: {
				connect: [{ type: 'contribution' }],
			},
		},
	});
	console.log(`Created the '${RANKING_TYPE}' ranking.`);
};

createContributorsRanking().then(() => {
	console.log('Done');
	process.exit(0);
}).catch((err) => {
	console.error(err);
	process.exit(1);
});
