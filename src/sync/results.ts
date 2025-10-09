import { getRanking, getScoresNormalDistribution, getUserScores, RANKING_MAX } from '../utils';
import { prisma } from './base';

export const calculateResults = async function(): Promise<void> {
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
		console.log(`Calculating results for season ${season.coalition?.name} (ended at ${season.end_at.toISOString()})...`);
		for (const coalition of season.bloc.coalitions) {
			console.log(` - Calculating results for coalition ${coalition.name}...`);

			// Entire coalition score
			const score = await getScoresNormalDistribution(prisma, coalition.id, season.end_at);
			console.log(`   - Total score for coalition ${coalition.name}: ${score}`);
			const result = await prisma.codamCoalitionSeasonResult.create({
				data: {
					coalition_id: coalition.id,
					score: score.mean,
					bloc_deadline_id: season.id,
				},
			});

			// Individual user scores
			const users = await prisma.intraCoalitionUser.findMany({
				where: {
					coalition_id: coalition.id,
				},
				select: {
					user_id: true,
					user: {
						select: {
							login: true,
						},
					},
				},
			});
			for (const user of users) {
				const { userScores, totalScore } = await getUserScores(prisma, user.user_id, season.end_at);
				if (totalScore === 0) {
					continue;
				}
				console.log(`   - User ${user.user.login} scored ${totalScore} points in coalition ${coalition.name}`);
				const userResult = await prisma.codamCoalitionUserResult.create({
					data: {
						user_id: user.user_id,
						coalition_id: coalition.id,
						score: totalScore,
						season_result_id: result.id,
					}
				});
			}

			// Tournament rankings
			const rankings = await prisma.codamCoalitionRanking.findMany({});
			for (const ranking of rankings) {
				const rankings = await getRanking(prisma, ranking.type, season.end_at, RANKING_MAX);
				for (const userRanking of rankings) {
					console.log(`   - User ${userRanking.user.login} ranked #${userRanking.rank} with ${userRanking.score} points in ranking ${ranking.type}`);
					const dbRanking = await prisma.codamCoalitionRankingResult.create({
						data: {
							ranking_type: ranking.type,
							season_result_id: result.id,
							user_id: userRanking.user.id,
							rank: userRanking.rank,
							score: userRanking.score,
						}
					});
				}
			}
		}
	}
};
