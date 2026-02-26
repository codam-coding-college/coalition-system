import express from 'express';
import bodyParser from 'body-parser';
import NodeCache from 'node-cache';
import { Request, Response, NextFunction } from "express";
import { CustomSessionData } from "./session";
import { ExpressIntraUser } from '../sync/oauth';
import { isStaff } from '../utils';
import { prisma } from '../main';


const checkIfAuthenticated = function(req: Request, res: Response, next: NextFunction) {
	if (req.path.startsWith('/login') || req.path.startsWith('/logout') || res.statusCode === 503) {
		return next(); // Don't require authentication for login/logout
	}
	if (req.path.startsWith('/hooks/')) {
		return next(); // Don't require authentication for webhooks
	}
	if (req.path.startsWith('/static/')) {
		return next(); // Don't require authentication for static resources
	}
	if (req.path.startsWith('/canvas')) {
		return next(); // Don't require authentication for the canvas generated leaderboard
	}
	if (req.isAuthenticated()) {
		return next();
	}
	// Only save the path for return-to if we are not requesting a static resource
	if (!req.path.match(/^.*\.[^\\]+$/)) {
		// Store the path the user was trying to access
		(req.session as CustomSessionData).returnTo = req.originalUrl;
		return res.redirect('/login');
	}
};

const expressErrorHandler = function(err: any, req: Request, res: Response, next: NextFunction) {
	console.error(err);
	res.status(500);
	return res.send('Internal server error');
};

const includeUser = function(req: Request, res: Response, next: NextFunction) {
	if (req.isAuthenticated()) {
		res.locals.user = req.user;
	}
	next();
};

const coalitionCache = new NodeCache({ stdTTL: 3000, checkperiod: 300 });
const includeCoalitions = async function(req: Request, res: Response, next: NextFunction) {
	if (coalitionCache.has('coalitions')) {
		res.locals.coalitions = coalitionCache.get('coalitions');
		return next();
	}
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
				},
			},
		},
	});
	coalitionCache.set('coalitions', coalitions);
	res.locals.coalitions = coalitions;
	next();
};

const staffMiddleware = async function(req: Request, res: Response, next: NextFunction) {
	const user = req.user as ExpressIntraUser;
	if (await isStaff(user)) {
		return next();
	}
	return res.status(403).send('Forbidden');
};

export const setupExpressMiddleware = function(app: any) {
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: true }));
	app.use(checkIfAuthenticated);
	app.use(includeUser);
	app.use(includeCoalitions);
	app.all('/admin*', staffMiddleware); // require staff accounts to access admin routes
	app.use(expressErrorHandler); // should remain last
	// More middleware for session management and authentication are defined in usePassport in authentication.ts
};
