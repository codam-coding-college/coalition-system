import { Express } from 'express';
import { PrismaClient } from '@prisma/client';

export const setupWebhookManagementRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/hooks/history', async (req, res) => {
		return res.render('admin/hooks/history.njk');
	});
};
