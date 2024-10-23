import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { CURSUS_ID } from '../../env';
import { ChartConfiguration } from 'chart.js';

export const setupAdminChartsRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/charts/coalitions/users/distribution', async (req, res) => {
		// Get the distribution of users per coalition
		const distribution = await prisma.intraCoalitionUser.groupBy({
			by: ['coalition_id'],
			_count: {
				coalition_id: true,
			},
			where: {
				user: {
					// only count users with an active 42cursus
					cursus_users: {
						some: {
							cursus_id: CURSUS_ID,
							end_at: null,
						}
					}
				}
			}
		});
		const coalitions = await prisma.intraCoalition.findMany({
			select: {
				id: true,
				name: true,
				color: true,
			},
		});

		// Count the users not in a coalition but with an active cursus_user
		const usersWithoutCoalition = await prisma.intraUser.findMany({
			select: {
				id: true,
				coalition_users: true,
				cursus_users: true,
			},
			where: {
				AND: {
					coalition_users: {
						none: {},
					},
					cursus_users: {
						some: {
							cursus_id: CURSUS_ID,
							end_at: null,
						},
					},
				},
			},
		});
		const usersWithoutCoalitionCount = usersWithoutCoalition.length;

		// Compose the returnable data (in a format Chart.js can understand)
		const chartJSData: ChartConfiguration = {
			type: 'bar',
			data: {
				labels: coalitions.map((coalition) => coalition.name).concat('No coalition'),
				datasets: [
					{
						label: 'Users',
						data: distribution.map((dist) => dist._count.coalition_id).concat(usersWithoutCoalitionCount),
						backgroundColor: coalitions.map((coalition) => (coalition.color ? coalition.color : '#808080')).concat('#808080'),
						borderWidth: 1,
					},
				],
			},
			options: {
				plugins: {
					legend: {
						display: false,
					}
				},
			}
		}
		return res.json(chartJSData);
	});
}
