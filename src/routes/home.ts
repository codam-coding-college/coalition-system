import { Express } from 'express';
import passport from 'passport';
import { CodamCoalition, PrismaClient } from '@prisma/client';
import { isQuizAvailable } from './quiz';
import { ExpressIntraUser } from '../sync/oauth';
import { getCoalitionScore, CoalitionScore, getRanking, SingleRanking, getBlocAtDate, scoreSumsToRanking, getCoalitionTopContributors, SMALL_CONTRIBUTION_TYPES, bonusPointsAwardingStarted } from '../utils';

export const setupHomeRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async (req, res) => {
		const user = req.user as ExpressIntraUser;
		const now = new Date();

		// Get all coalitions
		const coalitions = await prisma.codamCoalition.findMany({
			select: {
				id: true,
				description: true,
				tagline: true,
				intra_coalition: {
					select: {
						id: true,
						name: true,
						color: true,
						image_url: true,
						cover_url: true,
					}
				}
			}
		});

		// Map all coalitions to their id
		const coalitionsObject: { [key: number]: CodamCoalition } = {};
		for (const coalition of coalitions) {
			coalitionsObject[coalition.id] = coalition;
		}

		// Get current scores per coalition
		const coalitionScores: { [key: number]: CoalitionScore } = {};
		for (const coalition of coalitions) {
			coalitionScores[coalition.id] = await getCoalitionScore(prisma, coalition.id);
		}

		// Sort the coalitions by score
		const sortedCoalitionScores = Object.entries(coalitionScores).sort((a, b) => b[1].score - a[1].score);

		// Get current bloc deadline
		const currentBlocDeadline = await getBlocAtDate(prisma);
		const nextBlocDeadline = await prisma.intraBlocDeadline.findFirst({
			orderBy: {
				begin_at: 'asc',
			},
			where: {
				begin_at: {
					gt: now,
				},
			},
		});

		// Get the coalition of the current user
		const my_coalition = await prisma.intraCoalitionUser.findFirst({
			where: {
				user_id: user.id,
			},
			select: {
				coalition: {
					select: {
						id: true,
						name: true,
						color: true,
						image_url: true,
						codam_coalition: {
							select: {
								description: true,
								tagline: true,
							},
						},
					},
				},
			},
		});

		// Get rankings
		const rankingTypes = await prisma.codamCoalitionRanking.findMany({
			select: {
				type: true,
				name: true,
				description: true,
				bonus_points: true,
			},
			orderBy: {
				type: 'asc',
			},
		});
		const rankings: { [key: string]: SingleRanking[] } = {};
		for (const rankingType of rankingTypes) {
			rankings[rankingType.type] = await getRanking(prisma, rankingType.type);
		}

		// Check if bonus points awarding for rankings has started (7 days prior to end of the bloc)
		const bonusPointsAwarding = await bonusPointsAwardingStarted(prisma, now);
		const rankingBonusPoints: { [key: string]: {
			total: number;
			awarded: number;
			remaining: number;
		} } = {};
		if (bonusPointsAwarding.startTime && bonusPointsAwarding.started) {
			// Calculate how many bonus points are left to award per ranking type
			for (const rankingType of rankingTypes) {
				const totalBonusPoints = rankingType.bonus_points;
				if (!totalBonusPoints || totalBonusPoints <= 0) {
					continue;
				}
				const bonusPointsPerHour = Math.floor(totalBonusPoints / (7 * 24));
				// Bonus points are awarded every hour during the last 7 days
				let awardedBonusPoints = 0;
				for (let dt = new Date(bonusPointsAwarding.startTime); dt < now; dt.setHours(dt.getHours() + 1)) {
					awardedBonusPoints += bonusPointsPerHour;
				}
				const remainingBonusPoints = totalBonusPoints - awardedBonusPoints;
				rankingBonusPoints[rankingType.type] = {
					total: totalBonusPoints,
					awarded: Math.min(awardedBonusPoints, totalBonusPoints),
					remaining: Math.max(remainingBonusPoints, 0),
				};
			}
		}
		else {
			// No bonus points have been awarded yet
			for (const rankingType of rankingTypes) {
				const totalBonusPoints = rankingType.bonus_points;
				if (!totalBonusPoints || totalBonusPoints <= 0) {
					continue;
				}
				rankingBonusPoints[rankingType.type] = {
					total: totalBonusPoints,
					awarded: 0,
					remaining: totalBonusPoints,
				};
			}
		}

		// Check if quiz is currently available
		const quiz_available = await isQuizAvailable(user, prisma);

		return res.render('home.njk', {
			coalitions,
			coalitionsObject,
			my_coalition,
			now,
			currentBlocDeadline,
			nextBlocDeadline,
			quiz_available,
			sortedCoalitionScores,
			rankingTypes,
			rankings,
			bonusPointsAwarding,
			rankingBonusPoints,
		});
	});

	app.get('/coalitions/:coalitionId', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async (req, res) => {
		const coalitionId = parseInt(req.params.coalitionId);
		if (!coalitionId || isNaN(coalitionId) || coalitionId <= 0) {
			return res.status(400).send('Invalid coalition ID');
		}
		const user = req.user as ExpressIntraUser;
		const now = new Date();

		const coalition = await prisma.codamCoalition.findFirst({
			where: {
				id: parseInt(req.params.coalitionId),
			},
			include: {
				intra_coalition: true,
			},
		});
		if (!coalition) {
			return res.status(404).send('Coalition not found');
		}

		const bloc = await getBlocAtDate(prisma, now);
		if (!bloc) {
			// No ongoing season, there's no point in viewing this page. Redirect to home.
			return res.redirect('/');
		}

		// Get current coalition score
		const coalitionScore = await getCoalitionScore(prisma, coalition.id);

		// Get the top 25 contributors of this season
		const topContributors = await getCoalitionTopContributors(prisma, coalition.id, 'Top contributors of this season', now, 25);

		// Get the top contributors of the past 7 days
		const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		if (sevenDaysAgo < bloc.begin_at) {
			// If the season started less than 7 days ago, we can't get the top contributors of the past 7 days.
			// Get the top contributors since the season's start instead.
			sevenDaysAgo.setTime(bloc.begin_at.getTime());
			console.log('Season started less than 7 days ago, getting top contributors since season start instead');
		}
		const topScoresWeek = await prisma.codamCoalitionScore.groupBy({
			by: ['user_id'],
			_sum: {
				amount: true,
			},
			orderBy: {
				_sum: {
					amount: 'desc',
				},
			},
			where: {
				coalition_id: coalition.id,
				created_at: {
					gte: sevenDaysAgo,
					lte: now,
				},
			},
			take: 10,
		});
		const topContributorsWeek = await scoreSumsToRanking(prisma, topScoresWeek, 'Top contributors of the past 7 days');

		const latestScores = await prisma.codamCoalitionScore.findMany({
			where: {
				coalition_id: coalition.id,
			},
			orderBy: {
				created_at: 'desc',
			},
			include: {
				user: {
					select: {
						intra_user: {
							select: {
								login: true,
								usual_full_name: true,
								image: true,
							},
						},
					},
				},
			},
			take: 50,
		});

		const latestBigScores = await prisma.codamCoalitionScore.findMany({
			where: {
				coalition_id: coalition.id,
				OR: [
					{
						NOT: {
							fixed_type_id: {
								in: SMALL_CONTRIBUTION_TYPES, // Exclude usually low individual scores
							}
						},
					},
					{
						fixed_type_id: null, // Do include scores that are not fixed types
					}
				],
				amount: {
					gt: 0,
				},
				created_at: {
					gte: sevenDaysAgo,
					lte: now,
				},
			},
			orderBy: {
				created_at: 'desc',
			},
			include: {
				user: {
					select: {
						intra_user: {
							select: {
								login: true,
								usual_full_name: true,
								image: true,
							},
						},
					},
				},
			},
			take: 25,
		});

		// Get the staff part of this coalition
		const staff = await prisma.intraUser.findMany({
			where: {
				kind: 'admin',
				coalition_users: {
					some: {
						coalition_id: coalition.id,
					},
				},
				cursus_users: {
					some: {
						end_at: null, // Make sure to only get active staff members
					},
				},
			},
			include: {
				coalition_users: {
					where: {
						coalition_id: coalition.id,
					},
				},
				cursus_users: true,
			},
		});

		return res.render('coalition.njk', {
			coalition,
			topContributors,
			topContributorsWeek,
			latestScores,
			latestBigScores,
			coalitionScore,
			staff,
		});
	});
};
