import session from 'express-session';
import passport from 'passport';
import OAuth2Strategy from 'passport-oauth2';
import { PrismaClient } from '@prisma/client';
import { INTRA_API_UID, INTRA_API_SECRET, URL_ORIGIN, SESSION_SECRET, NODE_ENV } from '../env';
import { getIntraUser, ExpressIntraUser } from '../sync/oauth';
import { isStudent, isStaff } from '../utils';
import { PrismaSessionStore } from '@quixo3/prisma-session-store';

export const setupPassport = function(prisma: PrismaClient): void {
	passport.use(new OAuth2Strategy({
		authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
		tokenURL: 'https://api.intra.42.fr/oauth/token',
		clientID: INTRA_API_UID,
		clientSecret: INTRA_API_SECRET,
		callbackURL: `${URL_ORIGIN}/login/42/callback`,
	}, async (accessToken: string, refreshToken: string, profile: any, cb: any) => {
		try {
			const user = await getIntraUser(accessToken);;
			return cb(null, user);
		}
		catch (err) {
			return cb(err, false);
		}
	}));

	passport.serializeUser((user: Express.User, cb: any) => {
		process.nextTick(() => {
			const serializedUser = user as ExpressIntraUser;
			return cb(null, serializedUser.login);
		});
	});

	passport.deserializeUser((login: string, cb: any) => {
		process.nextTick(async () => {
			const user = await prisma.intraUser.findFirst({
				where: {
					login: login,
				},
			});
			if (!user) {
				return cb(new Error('User not found on deserialization'));
			}
			const intraUser: ExpressIntraUser = {
				id: user.id,
				email: user.email,
				login: user.login,
				first_name: user.first_name,
				last_name: user.last_name,
				usual_first_name: user.usual_first_name,
				usual_full_name: user.usual_full_name,
				display_name: user.display_name,
				kind: user.kind,
				isStudent: await isStudent(prisma, user),
				isStaff: await isStaff(user),
				image_url: user.image,
			};
			cb(null, intraUser);
		});
	});
};

export const usePassport = function(app: any, prisma: PrismaClient): void {
	if (NODE_ENV === 'production') {
		app.set('trust proxy', 1) // Trust first proxy
	}
	app.use(passport.initialize());
	app.use(session({
		cookie: {
			maxAge: 1000 * 60 * 60 * 24 * 7, // ms
			secure: (NODE_ENV === 'production'), // Secure HTTPS cookies only in production
		},
		name: 'nl.codam.coalitions.session',
		proxy: (NODE_ENV === 'production'), // Trust the X-Forwarded-Proto header
		secret: SESSION_SECRET,
		resave: false, // should not be set to true: deprecated!
		saveUninitialized: false, // should not be set to true: GDPR
		store: new PrismaSessionStore(
			prisma,
			{
				checkPeriod: 2 * 60 * 1000, // ms
				dbRecordIdIsSessionId: true,
				dbRecordIdFunction: undefined,
			},
		),
	}));
	app.use(passport.session());
};
