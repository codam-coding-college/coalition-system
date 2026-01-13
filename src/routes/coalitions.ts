import { Express } from 'express';
import passport from 'passport';
import { IntraUser, PrismaClient } from '@prisma/client';
import { ExpressIntraUser } from '../sync/oauth';
import { getCoalitionScore, getBlocAtDate, scoreSumsToRanking, getCoalitionTopContributors, SMALL_CONTRIBUTION_TYPES } from '../utils';
import { ASSISTANT_GROUP_ID, ASSISTANTS_CAN_QUIZ } from '../env';

export const setupCoalitionRoutes = function(app: Express, prisma: PrismaClient): void {
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
		});

		// Get the assistants part of this coalition
		let assistants: IntraUser[] = [];
		let assistantGroup = null;
		if (ASSISTANT_GROUP_ID && ASSISTANTS_CAN_QUIZ) {
			assistantGroup = await prisma.intraGroup.findUnique({
				where: {
					id: ASSISTANT_GROUP_ID,
				},
			});
			assistants = await prisma.intraUser.findMany({
				where: {
					group_users: {
						some: {
							group_id: ASSISTANT_GROUP_ID,
						},
					},
					coalition_users: {
						some: {
							coalition_id: coalition.id,
						},
					},
				},
			});
		}

		return res.render('coalition.njk', {
			coalition,
			topContributors,
			topContributorsWeek,
			latestScores,
			latestBigScores,
			coalitionScore,
			staff,
			assistantGroup,
			assistantsCanQuiz: ASSISTANTS_CAN_QUIZ,
			assistants,
		});
	});
};
