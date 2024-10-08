import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { setupAdminDashboardRoutes } from './admin/dashboard';
import { setupAdminQuizRoutes } from './admin/quiz';
import { setupAdminPointsRoutes } from './admin/points';
import { setupAPISearchRoutes } from './admin/apisearcher';
import { setupWebhookTriggerRoutes } from './hooks/triggers';
import { setupAdminUserRoutes } from './admin/users';
import { setupAdminCoalitionRoutes } from './admin/coalitions';

export const setupAdminRoutes = function(app: Express, prisma: PrismaClient): void {
	setupAdminDashboardRoutes(app, prisma);
	setupAdminQuizRoutes(app, prisma);
	setupAdminPointsRoutes(app, prisma);
	setupAPISearchRoutes(app, prisma);
	setupWebhookTriggerRoutes(app, prisma);
	setupAdminUserRoutes(app, prisma);
	setupAdminCoalitionRoutes(app, prisma);

	app.get('/admin', async (req, res) => {
		return res.render('admin/dashboard.njk');
	});
};
