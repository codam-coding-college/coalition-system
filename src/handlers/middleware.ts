import express from 'express';
import bodyParser from 'body-parser';
import { Request, Response, NextFunction } from "express";
import { CustomSessionData } from "./session";
import { ExpressIntraUser } from '../sync/oauth';
import { isStaff } from '../utils';


const checkIfAuthenticated = function(req: Request, res: Response, next: NextFunction) {
	if (req.path.startsWith('/login') || req.path.startsWith('/logout') || res.statusCode === 503) {
		return next();
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

const staffMiddleware = async function(req: Request, res: Response, next: NextFunction) {
	const user = req.user as ExpressIntraUser;
	if (await isStaff(user)) {
		return next();
	}
	return res.status(403).send('Forbidden');
};

export const setupExpressMiddleware = function(app: any) {
	app.use(express.static('static'));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: true }));
	app.use(checkIfAuthenticated);
	app.use(includeUser);
	app.all('/admin/*', staffMiddleware); // require staff accounts to access admin routes
	app.use(expressErrorHandler); // should remain last
};
