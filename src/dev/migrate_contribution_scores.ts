import { prisma } from '../handlers/db';

// Keyword used to identify legacy open source contribution scores by their (free-text) reason.
// Before the dedicated 'contribution' fixed point type existed, staff awarded these as custom
// scores (fixed_type_id = null) with reasons like "Contributed to Codam's open source projects (...)".
const CONTRIBUTION_REASON_KEYWORD = 'contributed';

// Tags existing custom contribution scores with the 'contribution' fixed point type so that they
// count towards the Top Contributors ranking. Run this once after deploying the contribution ranking.
const migrateContributionScores = async function(): Promise<void> {
	// Make sure the contribution fixed point type exists (created on application startup)
	const contributionType = await prisma.codamCoalitionFixedType.findFirst({
		where: {
			type: 'contribution',
		},
	});
	if (!contributionType) {
		throw new Error("The 'contribution' fixed point type does not exist yet. Start the application at least once before running this migration.");
	}

	const result = await prisma.codamCoalitionScore.updateMany({
		where: {
			fixed_type_id: null,
			reason: {
				contains: CONTRIBUTION_REASON_KEYWORD,
				mode: 'insensitive',
			},
		},
		data: {
			fixed_type_id: 'contribution',
		},
	});

	console.log(`Tagged ${result.count} existing score(s) with the 'contribution' fixed point type.`);
};

migrateContributionScores().then(() => {
	console.log('Contribution score migration complete');
	process.exit(0);
}).catch((err) => {
	console.error(err);
	process.exit(1);
});
