import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { setupAdminDashboardRoutes } from './admin/dashboard';
import { setupAdminQuizRoutes } from './admin/quiz';
import { setupAdminPointsRoutes } from './admin/points';
import { setupAPISearchRoutes } from './admin/apisearcher';
import { setupWebhookTriggerRoutes } from './hooks/triggers';
import { setupWebhookManagementRoutes } from './admin/hooksmgmt';
import { setupAdminUserRoutes } from './admin/users';
import { setupAdminCoalitionRoutes } from './admin/coalitions';
import { setupAdminChartsRoutes } from './admin/charts';
import { setupAdminRankingRoutes } from './admin/rankings';
import { setupAdminTitleRoutes } from './admin/titles';

export const setupAdminRoutes = function(app: Express, prisma: PrismaClient): void {
	setupAdminDashboardRoutes(app, prisma);
	setupAdminQuizRoutes(app, prisma);
	setupAdminPointsRoutes(app, prisma);
	setupAPISearchRoutes(app, prisma);
	setupWebhookTriggerRoutes(app, prisma);
	setupWebhookManagementRoutes(app, prisma);
	setupAdminUserRoutes(app, prisma);
	setupAdminCoalitionRoutes(app, prisma);
	setupAdminChartsRoutes(app, prisma);
	setupAdminRankingRoutes(app, prisma);
	setupAdminTitleRoutes(app, prisma);
};
