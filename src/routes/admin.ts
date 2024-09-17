import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { setupAdminDashboardRoutes } from './admin/dashboard';
import { setupAdminQuizRoutes } from './admin/quiz';

export const setupAdminRoutes = function(app: Express, prisma: PrismaClient): void {
	setupAdminDashboardRoutes(app, prisma);
	setupAdminQuizRoutes(app, prisma);
};
