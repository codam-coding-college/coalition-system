import { Express } from 'express';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import { isQuizAvailable } from './quiz';
import { ExpressIntraUser } from '../sync/oauth';

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

		// Check if quiz is currently available
		const quiz_available = await isQuizAvailable(user, prisma);

		return res.render('home.njk', {
			coalitions,
			my_coalition,
			quiz_available,
		});
	});
};
