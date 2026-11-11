import { Express } from 'express';
import { Readable } from 'stream';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import { Fast42 } from '@codam/fast42';

export const setupCDNProxyRoutes = function(app: Express, prisma: PrismaClient, api: Fast42): void {
	app.get('/cdn/proxy', passport.authenticate('session', {
			keepSessionInfo: true,
		}), async (req, res) => {
		const url = req.query.url as string;
		if (!url) {
			return res.status(400).send('Missing url query parameter');
		}

		const allowedDomains = ['cdn.intra.42.fr'];
		const parsedUrl = new URL(url);

		if (!allowedDomains.includes(parsedUrl.hostname)) {
			return res.status(403).send('Forbidden domain');
		}

		if (!parsedUrl.pathname.startsWith('/')) {
			return res.status(400).send('Invalid URL path');
		}

		const response = await api.download(url);
		if (response.ok && response.body) {
			res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
			res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 7 days
			res.setHeader('Content-Length', response.headers.get('content-length') || '0');
			return Readable.fromWeb(response.body as any).pipe(res);
		} else {
			return res.status(response.status).send('Failed to download resource');
		}
	});

	app.get('/cdn/users/:userId/picture', passport.authenticate('session', {
			keepSessionInfo: true,
		}), async (req, res) => {
		// User ID is expected to be a number, but we should validate it
		const userId = parseInt(req.params.userId);
		if (isNaN(userId)) {
			return res.status(400).send('Invalid user ID');
		}

		const user = await prisma.intraUser.findUnique({
			where: {
				id: userId,
			},
		});

		if (!user) {
			return res.status(404).send('User not found');
		}

		if (!user.image) {
			return res.status(404).send('User does not have a profile picture');
		}

		const picture = await api.download(user.image);
		if (picture.ok && picture.body) {
			res.setHeader('Content-Type', picture.headers.get('content-type') || 'image/jpeg');
			res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 7 days
			res.setHeader('Content-Length', picture.headers.get('content-length') || '0');
			return Readable.fromWeb(picture.body as any).pipe(res);
		} else {
			return res.status(picture.status).send('Failed to download user profile picture');
		}
	});
};
