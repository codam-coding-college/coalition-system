import { Express } from 'express';
import passport from 'passport';
import { CodamCoalition, PrismaClient } from '@prisma/client';
import { isQuizAvailable } from './quiz';
import { ExpressIntraUser } from '../sync/oauth';
import { getCoalitionScore, CoalitionScore, getRanking, SingleRanking, getBlocAtDate, scoreSumsToRanking, getCoalitionTopContributors } from '../utils';

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
			},
			orderBy: {
				type: 'asc',
			},
		});
		const rankings: { [key: string]: SingleRanking[] } = {};
		for (const rankingType of rankingTypes) {
			rankings[rankingType.type] = await getRanking(prisma, rankingType.type);
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

		const bloc = await getBlocAtDate(prisma, new Date());
		if (!bloc) {
			// No ongoing season, there's no point in viewing this page. Redirect to home.
			return res.redirect('/');
		}

		// Get the top contributors of this seasona
		const topContributors = await getCoalitionTopContributors(prisma, coalition.id, 'Top contributors of this season');

		// Get the top contributors of the past 7 days
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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
					lte: new Date(),
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

		const latestTopScores = await prisma.codamCoalitionScore.findMany({
			where: {
				coalition_id: coalition.id,
				OR: [
					{
						NOT: {
							fixed_type_id: {
								in: ['logtime', 'evaluation'], // Exclude logtime and evaluation scores, they are usually low
							}
						},
					},
					{
						fixed_type_id: null, // Include scores that are not fixed types
					}
				],
				amount: {
					gt: 0,
				},
				created_at: {
					gte: sevenDaysAgo,
					lte: new Date(),
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
			latestTopScores,
			staff,
		});
	});
};
