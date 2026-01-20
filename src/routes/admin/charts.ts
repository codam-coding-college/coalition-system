import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { CURSUS_ID } from '../../env';
import { ChartConfiguration } from 'chart.js';
import { getBlocAtDate } from '../../utils';
import NodeCache from 'node-cache';

const adminChartDataCache = new NodeCache({ stdTTL: 60 * 5, checkperiod: 60 * 5 });

export const setupAdminChartsRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/charts/coalitions/users/distribution', async (req, res) => {
		// Check cache first
		const cachedData = adminChartDataCache.get<ChartConfiguration>('coalitionsUsersDistribution');
		if (cachedData) {
			return res.json(cachedData);
		}

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
							OR: [
								{ end_at: null },
								{ end_at: { gt: new Date() } }, // also consider cursus_users that are still active at the current date
							],
						},
					},
				},
			},
			orderBy: {
				_count: {
					coalition_id: 'desc',
				},
			},
		});
		const coalitions = await prisma.intraCoalition.findMany({
			select: {
				id: true,
				name: true,
				color: true,
			},
			orderBy: {
				id: 'desc',
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
							OR: [
								{ end_at: null },
								{ end_at: { gt: new Date() } }, // also consider cursus_users that are still active at the current date
							],
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
			},
		}

		// Cache and return the data
		adminChartDataCache.set('coalitionsUsersDistribution', chartJSData);

		return res.json(chartJSData);
	});

	app.get('/admin/charts/coalitions/:coalitionId/scores/distribution', async (req, res) => {
		try {
			const coalitionId = parseInt(req.params.coalitionId);

			// Check cache first
			const cachedData = adminChartDataCache.get<ChartConfiguration>(`coalitionScoresDistribution_${coalitionId}`);
			if (cachedData) {
				return res.json(cachedData);
			}

			const coalition = await prisma.intraCoalition.findFirst({
				where: {
					id: coalitionId,
				},
				select: {
					id: true,
					name: true,
					color: true,
				}
			});
			if (!coalition) {
				throw new Error('Invalid coalition ID');
			}
			const currentBloc = await getBlocAtDate(prisma);
			if (!currentBloc) {
				throw new Error('No current bloc found');
			}

			const scores = await prisma.codamCoalitionScore.groupBy({
				by: ['user_id'],
				where: {
					coalition_id: coalitionId,
					created_at: {
						gte: currentBloc.begin_at,
						lte: new Date(),
					},
				},
				_sum: {
					amount: true,
				},
				_count: {
					id: true,
				},
				orderBy: {
					_sum: {
						amount: 'asc',
					},
				},
			});
			const coalitionUsers = await prisma.intraCoalitionUser.findMany({
				where: {
					coalition_id: coalitionId,
				},
				select: {
					user_id: true,
					user: {
						select: {
							login: true,
						},
					},
				},
			});

			const scoresPerUser = coalitionUsers.map((user) => {
				const score = scores.find((score) => score.user_id === user.user_id) || { _sum: { amount: 0 }, _count: { id: 0 } };
				return {
					login: user.user.login,
					amount: score._sum.amount,
					count: score._count.id,
				};
			});

			// Compose the returnable data (in a format Chart.js can understand)
			const chartJSData: ChartConfiguration = {
				type: 'scatter',
				data: {
					labels: scoresPerUser.map((score) => score.login),
					datasets: [
						{
							label: 'Scores',
							data: scoresPerUser.map((score) => ({ x: score.amount, y: score.count })) as Chart.ChartPoint[],
							backgroundColor: coalition.color ? coalition.color : '#808080',
							borderWidth: 1,
						},
					],
				},
				options: {
					scales: {
						// @ts-ignore
						x: {
							title: {
								display: true,
								text: 'Amount of points',
							},
						},
						y: {
							title: {
								display: true,
								text: 'Amount of scores',
							},
						},
					},
					plugins: {
						legend: {
							display: false,
						}
					},
				}
			};

			// Cache and return the data
			adminChartDataCache.set(`coalitionScoresDistribution_${coalitionId}`, chartJSData);

			return res.json(chartJSData);
		}
		catch (err) {
			return res.status(400).json({ error: err });
		}
	});
}
