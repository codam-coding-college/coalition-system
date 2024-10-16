import { Express } from 'express';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import { isQuizAvailable } from './quiz';

export const setupHomeRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async (req, res) => {
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

		// Check if quiz is currently available
		const quiz_available = await isQuizAvailable(prisma);

		return res.render('home.njk', {
			coalitions,
			quiz_available,
		});
	});
};
