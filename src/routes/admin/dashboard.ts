import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { CoalitionScore, getCoalitionScore } from '../../utils';

export const setupAdminDashboardRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin', async (req, res) => {
		// Get current bloc deadline
		const blocDeadline = await prisma.intraBlocDeadline.findFirst({
			orderBy: {
				end_at: 'desc',
			},
		});

		// Get coalitions
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
					}
				}
			}
		});

		// Get current scores per coalition
		const coalitionScores: { [key: number]: CoalitionScore } = {};
		for (const coalition of coalitions) {
			coalitionScores[coalition.id] = await getCoalitionScore(prisma, coalition.id);
		}

		return res.render('admin/dashboard.njk', {
			blocDeadline,
			coalitions,
			coalitionScores,
		});
	});
};
