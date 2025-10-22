import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { CoalitionScore, getCoalitionScore, getScoresPerType } from '../../utils';

export const setupAdminDashboardRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin', async (req, res) => {
		const now = new Date();

		// Get current bloc deadline
		const currentBlocDeadline = await prisma.intraBlocDeadline.findFirst({
			orderBy: {
				end_at: 'desc',
			},
			where: {
				begin_at: {
					gte: now,
				},
				end_at: {
					lt: now,
				},
			},
		});

		// Get previous bloc deadlines
		const blocDeadlines = await prisma.intraBlocDeadline.findMany({
			orderBy: {
				end_at: 'desc',
			},
			take: 10,
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

		// Get scores per type per coalition
		const coalitionScoresPerFixedType: { [key: number]: { [key: string]: number } } = {};
		for (const coalition of coalitions) {
			coalitionScoresPerFixedType[coalition.id] = await getScoresPerType(prisma, coalition.id);
		}

		return res.render('admin/dashboard.njk', {
			currentBlocDeadline,
			blocDeadlines,
			coalitions,
			coalitionScores,
			coalitionScoresPerFixedType,
		});
	});
};
