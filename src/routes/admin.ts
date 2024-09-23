import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import Fast42 from '@codam/fast42';
import { setupAdminDashboardRoutes } from './admin/dashboard';
import { setupAdminQuizRoutes } from './admin/quiz';
import { setupAdminPointsRoutes } from './admin/points';
import { setupAPISearchRoutes } from './admin/apisearcher';

export const setupAdminRoutes = function(app: Express, prisma: PrismaClient): void {
	setupAdminDashboardRoutes(app, prisma);
	setupAdminQuizRoutes(app, prisma);
	setupAdminPointsRoutes(app, prisma);
	setupAPISearchRoutes(app, prisma);

	app.get('/admin', async (req, res) => {
		return res.render('admin/dashboard.njk');
	});
};
