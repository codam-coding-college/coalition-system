import { Express } from 'express';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';

export const setupHomeRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async (req, res) => {
		return res.render('index.njk', {  });
	});
};
