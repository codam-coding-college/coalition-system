import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const deleteExistingRankings = async function(): Promise<void> {
	await prisma.codamCoalitionRanking.deleteMany({});
};

const createRanking = async function(name: string, description: string, topTitle: string, bonusPoints: number, fixedPointTypes: string[]): Promise<void> {
	await prisma.codamCoalitionRanking.create({
		data: {
			type: name.toLowerCase().replace(/ /g, '_'),
			name: name,
			description: description,
			top_title: topTitle,
			bonus_points: bonusPoints,
			disabled: false,
			fixed_types: {
				connect: fixedPointTypes.map((type) => {
					return {
						type: type,
					};
				}),
			},
		},
	});
};

const createRankings = async function(): Promise<void> {
	await createRanking('Guiding Stars', 'Based on points gained through evaluations', 'Guiding Star %login', 12600, ['evaluation']);
	await createRanking('Top Performers', 'Based on points gained through projects', 'Top Performer %login', 8400, ['project', 'exam']);
	await createRanking('Top Endeavors', 'Based on points gained through logtime', 'Top Endeavor %login', 16800, ['logtime', 'idle_logout']);
	await createRanking('Philanthropists', 'Based on points gained through donating evaluation points to the pool', 'Philanthropist %login', 16800, ['point_donated']);
	await createRanking('Community Leaders', 'Based on points gained through organizing events', 'Community Leader %login', 12600, ['event_basic', 'event_intermediate', 'event_advanced']);
};

const main = async function(): Promise<void> {
	await deleteExistingRankings();
	await createRankings();
};

main().then(() => {
	console.log('Rankings created');
	process.exit(0);
});
