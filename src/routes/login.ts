import { Express } from 'express';
import passport from 'passport';
import { ExpressIntraUser } from '../sync/oauth';
import { CustomSessionData } from '../handlers/session';
import { PrismaClient } from '@prisma/client';
import { CoalitionScore, getCoalitionScore } from '../utils';

export const setupLoginRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/login', async (req, res) => {
		const coalitions = await prisma.codamCoalition.findMany({
			include: {
				intra_coalition: {
					select: {
						name: true,
						image_url: true,
						color: true,
						cover_url: true,
					},
				},
			},
		});

		// Get current scores per coalition
		const coalitionScores: { [key: number]: CoalitionScore } = {};
		for (const coalition of coalitions) {
			coalitionScores[coalition.id] = await getCoalitionScore(prisma, coalition.id);
		}

		// Sort the coalitions by score
		const sortedCoalitionScores = Object.entries(coalitionScores).sort((a, b) => b[1].score - a[1].score);
		const sortedCoalitions = sortedCoalitionScores.map(([coalitionId]) => {
			return coalitions.find(c => c.id === parseInt(coalitionId));
		}).filter(c => c !== undefined) as typeof coalitions;

		return res.render('login.njk', {
			coalitions: sortedCoalitions,
		});
	});

	app.get('/login/failed', async (req, res) => {
		return res.render('login-failed.njk');
	});

	app.get('/login/42', passport.authenticate('oauth2'));
	app.get('/login/42/callback', passport.authenticate('oauth2', {
		failureRedirect: '/login/failed',
		keepSessionInfo: true,
	}), async (req, res) => {
		const user = req.user as ExpressIntraUser;
		console.log(`User ${user.login} logged in.`);
		req.user = user;
		req.session.save((err) => {
			if (err) {
				console.error('Failed to save session:', err);
			}
			// Check if there was a path the user was trying to access
			const returnTo = (req.session as CustomSessionData).returnTo;
			if (returnTo) {
				delete (req.session as CustomSessionData).returnTo;
				return res.redirect(returnTo);
			}
			res.redirect('/');
		});
	});

	app.get('/logout', async (req, res) => {
		req.session.destroy((err) => {
			if (err) {
				console.error('Failed to destroy session:', err);
			}
			console.log('Session destroyed.');
			res.redirect('/login');
		});
	});
};
