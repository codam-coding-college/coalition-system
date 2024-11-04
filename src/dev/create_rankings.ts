import { CodamCoalitionFixedType, CodamCoalitionRanking, PrismaClient } from '@prisma/client';
import { getCoalitionIds } from '../utils';
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
	await createRanking('Guiding Stars', 'Based on points gained through evaluations', 'Guiding Star', 100000, ['evaluation']);
	await createRanking('Top Performers', 'Based on points gained through projects', 'Top Performer', 100000, ['project', 'exam']);
	await createRanking('Top Endeavors', 'Based on points gained through logtime', 'Top Endeavor', 100000, ['logtime']);
	await createRanking('Philanthropists', 'Based on points gained through donating evaluation points to the pool', 'Philanthropist', 100000, ['point_donated']);
	await createRanking('Community Leaders', 'Based on points gained through organizing events', 'Community Leader', 100000, ['event_basic', 'event_intermediate', 'event_advanced']);
};

const main = async function(): Promise<void> {
	await deleteExistingRankings();
	await createRankings();
};

main().then(() => {
	console.log('Rankings created');
	process.exit(0);
});
