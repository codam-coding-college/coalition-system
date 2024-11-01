import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { CURSUS_ID } from '../../env';
import { ChartConfiguration } from 'chart.js';
import { CoalitionScore, getCoalitionScore } from '../../utils';

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
			},
		}
		return res.json(chartJSData);
	});

	app.get('/admin/charts/coalitions/:coalitionId/scores/distribution', async (req, res) => {
		try {
			const coalitionId = parseInt(req.params.coalitionId);
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
			const scores = await prisma.codamCoalitionScore.groupBy({
				by: ['user_id'],
				where: {
					coalition_id: coalitionId,
				},
				_sum: {
					amount: true,
				},
				_count: {
					id: true,
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

			return res.json(chartJSData);
		}
		catch (err) {
			return res.status(400).json({ error: err });
		}
	});

	app.get('/admin/charts/coalitions/scores/history', async (req, res) => {
		// TODO: change this to the full overview of a tournament deadline instead of past 30 days
		try {
			const coalitions = await prisma.intraCoalition.findMany({
				select: {
					id: true,
					name: true,
					color: true,
				}
			});
			if (coalitions.length === 0) {
				throw new Error('No coalitions found');
			}
			// Get the score for the past 30 days per day, 2 points per day (00:00 and 12:00)
			const dates = [];
			const now = new Date();
			now.setHours((now.getHours() > 12) ? 12 : 0, 0, 0, 0);
			const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			for (let i = 0; i <= 60; i++) {
				dates.push(new Date(monthAgo.getTime() + i * 12 * 60 * 60 * 1000));
			}

			// Get the scores for each coalition
			const coalitionDataPoints: { [key: number]: CoalitionScore[] } = {};
			for (const coalition of coalitions) {
				const dataPoints: CoalitionScore[] = [];
				for (const date of dates) {
					dataPoints[date.getTime()] = await getCoalitionScore(prisma, coalition.id, date);
				}
				coalitionDataPoints[coalition.id] = dataPoints;
			}

			// Compose the returnable data (in a format Chart.js can understand)
			const chartJSData: ChartConfiguration = {
				type: 'line',
				data: {
					labels: dates.map((date) => `${date.toLocaleDateString()} ${date.getHours()}:00`),
					datasets: [],
				},
				options: {
					showLines: true,
					scales: {
						// @ts-ignore
						x: {
							title: {
								display: false,
								text: 'Date',
							},
						},
						y: {
							title: {
								display: true,
								text: 'Amount of points',
							},
						},
					},
				}
			};
			for (const coalition of coalitions) {
				chartJSData.data!.datasets!.push({
					label: coalition.name,
					data: Object.values(coalitionDataPoints[coalition.id]).map((score) => score.score),
					borderColor: coalition.color ? coalition.color : '#808080',
					backgroundColor: coalition.color ? coalition.color : '#808080',
					fill: false,
					// @ts-ignore
					tension: 0.25,
				});
			}

			return res.json(chartJSData);
		}
		catch (err) {
			console.error(err);
			return res.status(400).json({ error: err });
		}
	});

	app.get('/admin/charts/coalitions/:coalitionId/scores/history', async (req, res) => {
		try {
			const coalitionId = parseInt(req.params.coalitionId);
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
			// Get the score for the past 30 days per day, 2 points per day (00:00 and 12:00)
			const dataPoints: CoalitionScore[] = [];
			const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			monthAgo.setHours(0, 0, 0, 0);
			for (let i = 0; i < 60; i++) {
				const date = new Date(monthAgo.getTime() + i * 12 * 60 * 60 * 1000);
				dataPoints[date.getTime()] = await getCoalitionScore(prisma, coalitionId, date);
			}

			// Compose the returnable data (in a format Chart.js can understand)
			const chartJSData: ChartConfiguration = {
				type: 'line',
				data: {
					labels: Object.keys(dataPoints).map((timestamp) => new Date(parseInt(timestamp)).toLocaleDateString()),
					datasets: [
						{
							label: 'Score',
							data: Object.values(dataPoints).map((score) => score.score),
							// borderColor: coalition.color ? coalition.color : '#808080',
							// backgroundColor: coalition.color ? coalition.color : '#808080',
							fill: false,
							// @ts-ignore
							tension: 0.25,
						},
						{
							label: 'Average points',
							data: Object.values(dataPoints).map((score) => score.avgPoints),
							// borderColor: coalition.color ? coalition.color : '#808080',
							// backgroundColor: coalition.color ? coalition.color : '#808080',
							fill: false,
							// @ts-ignore
							tension: 0.25,
						},
						{
							label: 'Standard deviation',
							data: Object.values(dataPoints).map((score) => score.stdDevPoints),
							// borderColor: coalition.color ? coalition.color : '#808080',
							// backgroundColor: coalition.color ? coalition.color : '#808080',
							fill: false,
							// @ts-ignore
							tension: 0.25,
						},
						{
							label: 'Min active points',
							data: Object.values(dataPoints).map((score) => score.minActivePoints),
							// borderColor: coalition.color ? coalition.color : '#808080',
							// backgroundColor: coalition.color ? coalition.color : '#808080',
							fill: false,
							// @ts-ignore
							tension: 0.25,
						},
					],
				},
				options: {
					showLines: true,
					scales: {
						// @ts-ignore
						x: {
							title: {
								display: true,
								text: 'Date',
							},
						},
						y: {
							title: {
								display: true,
								text: 'Amount of points',
							},
							min: 0,
						},
					},
					plugins: {
						legend: {
							display: true,
						}
					},
				}
			};

			return res.json(chartJSData);
		}
		catch (err) {
			console.error(err);
			return res.status(400).json({ error: err });
		}
	});
}
