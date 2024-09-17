import { Express } from 'express';
import { PrismaClient } from '@prisma/client';

export const setupAdminDashboardRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/dashboard', async (req, res) => {
		return res.render('admin/dashboard.njk');
	});
};
