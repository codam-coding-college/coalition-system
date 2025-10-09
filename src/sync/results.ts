import { getRanking, getScoresNormalDistribution, getUsersScores, RANKING_MAX } from '../utils';
import { prisma } from './base';

export const calculateResults = async function(): Promise<void> {
	console.log('Checking if any seasons have finished but have no results stored yet...');
	// Check if a season has ended but no results have been calculated yet
	const seasonsToCalculate = await prisma.intraBlocDeadline.findMany({
		where: {
			end_at: {
				lt: new Date(), // Where a season has ended
			},
			coalition_id: {
				not: null, // Where a winner is defined on Intra
			},
			codam_season_result: {
				none: {}, // Where no results have been calculated yet on the Codam Coalition System
			},
		},
		include: {
			bloc: {
				include: {
					coalitions: true, // All coalitions in the bloc
				},
			},
			coalition: true, // Winning coalition
		},
	});

	if (seasonsToCalculate.length === 0) {
		console.log('No seasons to calculate results for.');
		return;
	}

	// Calculate results for each season that needs it
	for (const season of seasonsToCalculate) {
		const seasonName = season.begin_at.toISOString().split('T')[0] + ' to ' + season.end_at.toISOString().split('T')[0];
		console.log(`Calculating results for season ${seasonName}...`);
		for (const coalition of season.bloc.coalitions) {
			console.log(` - Calculating results for coalition ${coalition.name}...`);

			// Check if there are any scores at all for this coalition in this season
			const scoresCount = await prisma.codamCoalitionScore.count({
				where: {
					coalition_id: coalition.id,
					created_at: {
						gte: season.begin_at,
						lte: season.end_at,
					},
				},
			});
			if (scoresCount === 0) {
				console.log(`   - No scores found for coalition ${coalition.name} in season ${seasonName}, skipping...`);
				continue;
			}

			// Entire coalition score
			const score = await getScoresNormalDistribution(prisma, coalition.id, season.end_at);
			console.log(`   - Final score for coalition ${coalition.name} in season ${seasonName}: ${score.mean}`);
			const result = await prisma.codamCoalitionSeasonResult.create({
				data: {
					coalition_id: coalition.id,
					score: score.mean,
					bloc_deadline_id: season.id,
				},
			});

			// Individual user scores
			const usersScores = await getUsersScores(prisma, coalition.id, season.end_at, RANKING_MAX);
			console.log(`   - Calculating individual results for ${usersScores.length} users in coalition ${coalition.name}...`);
			let rank = 0;
			let lastScore = Infinity;
			for (const userScore of usersScores) {
				console.log(`     - User ${userScore.user_id} scored ${userScore._sum.amount} points in coalition ${coalition.name}`);
				if ((userScore._sum.amount || 0) < lastScore) {
					rank++;
					lastScore = userScore._sum.amount || 0;
				}
				const userResult = await prisma.codamCoalitionUserResult.create({
					data: {
						user_id: userScore.user_id,
						coalition_id: coalition.id,
						score: userScore._sum.amount || 0,
						coalition_rank: rank,
						season_result_id: result.id,
					}
				});
			}
		}

		// Tournament rankings
		const rankings = await prisma.codamCoalitionRanking.findMany({});
		console.log(` - Calculating tournament rankings for season ${seasonName}...`);
		for (const ranking of rankings) {
			console.log(`   - Calculating ranking ${ranking.type}...`);
			const rankings = await getRanking(prisma, ranking.type, season.end_at, RANKING_MAX);
			for (const userRanking of rankings) {
				console.log(`     - User ${userRanking.user.login} ranked #${userRanking.rank} with ${userRanking.score} points in ranking ${ranking.type}`);
				const dbRanking = await prisma.codamCoalitionRankingResult.create({
					data: {
						ranking_type: ranking.type,
						bloc_deadline_id: season.id,
						user_id: userRanking.user.id,
						coalition_id: (userRanking.coalition ? userRanking.coalition.id : null),
						rank: userRanking.rank,
						score: userRanking.score,
					}
				});
			}
		}
	}
};
