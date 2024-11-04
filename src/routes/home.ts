import { Express } from 'express';
import passport from 'passport';
import { CodamCoalition, PrismaClient } from '@prisma/client';
import { isQuizAvailable } from './quiz';
import { ExpressIntraUser } from '../sync/oauth';
import { getCoalitionScore, CoalitionScore, getRanking, SingleRanking } from '../utils';

export const setupHomeRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async (req, res) => {
		const user = req.user as ExpressIntraUser;

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
			quiz_available,
			sortedCoalitionScores,
			rankingTypes,
			rankings,
		});
	});
};
