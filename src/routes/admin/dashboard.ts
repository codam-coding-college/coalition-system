import { Express } from 'express';
import { PrismaClient } from '@prisma/client';

export const setupAdminDashboardRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin', async (req, res) => {
		// Get current bloc deadline
		const blocDeadline = await prisma.intraBlocDeadline.findFirst({
			orderBy: {
				end_at: 'desc',
			},
		});

		return res.render('admin/dashboard.njk', {
			blocDeadline,
		});
	});
};
