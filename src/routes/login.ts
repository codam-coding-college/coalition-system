import { Express } from 'express';
import passport from 'passport';
import { ExpressIntraUser } from '../sync/oauth';
import { CustomSessionData } from '../handlers/session';

export const setupLoginRoutes = function(app: Express): void {
	app.get('/login', async (req, res) => {
		return res.render('login.njk');
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
