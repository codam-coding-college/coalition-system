import { Express } from 'express';
import { PrismaClient } from '@prisma/client';

export const setupAdminUserRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/users', async (req, res) => {
		return res.render('admin/users.njk');
	});
};
