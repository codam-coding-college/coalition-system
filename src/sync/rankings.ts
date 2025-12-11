import { getRanking, RANKING_MAX, getBlocAtDate } from '../utils';
import { handleFixedPointScore } from '../handlers/points';
import { prisma } from './base';
import { CodamCoalitionRanking } from '@prisma/client';

const handleRankingBonusForDateTime = async function(ranking: CodamCoalitionRanking, atDateTime: Date = new Date()): Promise<void> {
	console.log(` - Applying bonus points for ranking ${ranking.name} at ${atDateTime.toISOString()}...`);

	ranking.last_bonus_run = atDateTime;
	await prisma.codamCoalitionRanking.update({
		where: {
			type: ranking.type,
		},
		data: {
			last_bonus_run: ranking.last_bonus_run,
		},
	});

	// Get top users in this ranking at the specified date and time
	const topUsers = await getRanking(prisma, ranking.type, atDateTime, RANKING_MAX);
	if (topUsers.length === 0) {
		console.log(`   - No users found in ranking ${ranking.name}, skipping...`);
		return;
	}

	// Calculate bonus points to award per hour
	const bonusPointsPerHour = Math.floor((ranking.bonus_points || 0) / 168); // 168 hours in a week

	if (bonusPointsPerHour <= 0) {
		console.warn(`   - Bonus points to award this hour is 0 for ranking ${ranking.name}, skipping...`);
		return;
	}

	// Get fixed type for ranking bonus
	const fixedType = await prisma.codamCoalitionFixedType.findUnique({
		where: {
			type: 'ranking_bonus',
		},
	});
	if (!fixedType) {
		console.error(`   - Fixed type "ranking_bonus" not found, cannot award ranking bonus points for ranking ${ranking.name}, skipping...`);
		return;
	}

	// Award bonus points to the #1 spot (can be multiple users!)
	const topRankings = topUsers.filter(user => user.rank === 1);
	const pointsPerUser = Math.floor(bonusPointsPerHour / topRankings.length);
	for (const topUser of topRankings) {
		await handleFixedPointScore(prisma, fixedType, null, topUser.user.id, pointsPerUser, `Bonus points for being in${topRankings.length > 1 ? ' shared' : ''} first place on the ${ranking.name} Ranking`, atDateTime);
		console.log(`   - Awarded ${pointsPerUser} bonus points to ${topUser.user.login} (coalition ${(topUser.coalition ? topUser.coalition?.name : 'N/A')}) for ranking ${ranking.name}`);
	}
};

export const handleRankingBonuses = async function(): Promise<void> {
	console.log('Checking if any ranking bonuses need to be applied...');
	const now = new Date();
	const currentBloc = await getBlocAtDate(prisma, now);

	// Check if we're in the final week of the current season
	if (currentBloc === null) {
		console.log(' - No ongoing season, skipping ranking bonus application.');
		return;
	}
	const oneWeekBeforeEnd = new Date(currentBloc.end_at.getTime() - (7 * 24 * 60 * 60 * 1000));
	if (now < oneWeekBeforeEnd) {
		console.log(` - Not in the final week of the season yet, skipping ranking bonus application. Final week starts at ${oneWeekBeforeEnd.toISOString()}`);
		return;
	}

	// Get all rankings that are not disabled and have bonus points defined
	const rankings = await prisma.codamCoalitionRanking.findMany({
		where: {
			disabled: false,
			bonus_points: {
				gt: 0,
			},
		},
	});

	for (const ranking of rankings) {
		if (!ranking.last_bonus_run || ranking.last_bonus_run === undefined || ranking.last_bonus_run < oneWeekBeforeEnd) {
			console.log(` - Setting last bonus run to 1 week before the end of the current season...`);
			ranking.last_bonus_run = oneWeekBeforeEnd;
			await prisma.codamCoalitionRanking.update({
				where: {
					type: ranking.type,
				},
				data: {
					last_bonus_run: ranking.last_bonus_run,
				},
			});
		}

		// Apply bonus points for each hour since last run up until now
		for (let bonusDateTime = new Date(ranking.last_bonus_run.getTime() + 60 * 60 * 1000); bonusDateTime <= now; bonusDateTime = new Date(bonusDateTime.getTime() + 60 * 60 * 1000)) {
			await handleRankingBonusForDateTime(ranking, bonusDateTime);
		}
	}
};
