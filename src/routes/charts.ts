import { PrismaClient } from '@prisma/client';
import { ChartConfiguration } from 'chart.js';
import { Express } from 'express';
import { CoalitionScore, getCoalitionScore } from '../utils';

export const setupChartRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/charts/coalitions/scores/history', async (req, res) => {
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
							// hide x-xaxis labels
							ticks: {
								display: false,
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

	app.get('/charts/coalitions/:coalitionId/scores/history', async (req, res) => {
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
							// hide x-xaxis labels
							ticks: {
								display: false,
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

	app.get('/charts/users/:login/points/total', async (req, res) => {
		try {
			const user = await prisma.intraUser.findFirst({
				where: {
					login: req.params.login,
				},
				select: {
					id: true,
					coalition_users: {
						select: {
							coalition: {
								select: {
									id: true,
									name: true,
									color: true,
								},
							},
						},
					},
				},
			});
			if (!user || !user.coalition_users || user.coalition_users.length === 0) {
				return res.status(404).send('User not found or not in a coalition');
			}

			// Get the score for the past 30 days per day, 2 points per day (00:00 and 12:00)
			// TODO: change this to the entire current tournament
			const dates: Date[] = [];
			const now = new Date();
			now.setHours((now.getHours() > 12) ? 12 : 0, 0, 0, 0);
			const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			for (let i = 0; i <= 60; i++) {
				dates.push(new Date(monthAgo.getTime() + i * 12 * 60 * 60 * 1000));
			}

			// Get all scores for this user for the past 30 days
			const scoreSumsPerDate: { [key: number]: number } = {};
			for (const date of dates) {
				const scores = await prisma.codamCoalitionScore.groupBy({
					by: ['user_id'],
					_sum: {
						amount: true,
					},
					where: {
						user_id: user.id,
						created_at: {
							gte: monthAgo,
							lt: date,
						},
					},
				});
				for (const score of scores) {
					scoreSumsPerDate[date.getTime()] = score._sum.amount || 0;
				}
			}

			// Compose the returnable data (in a format Chart.js can understand)
			const chartJSData: ChartConfiguration = {
				type: 'line',
				data: {
					labels: dates.map((date) => `${date.toLocaleDateString()} ${date.getHours()}:00`),
					datasets: [{
						label: 'Total points',
						data: dates.map(date => scoreSumsPerDate[date.getTime()] || 0),
						// @ts-ignore
						tension: 0.25,
					}],
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
							// hide x-xaxis labels
							ticks: {
								display: false,
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

	app.get('/charts/users/:login/points/split', async (req, res) => {
		try {
			const user = await prisma.intraUser.findFirst({
				where: {
					login: req.params.login,
				},
				select: {
					id: true,
					coalition_users: {
						select: {
							coalition: {
								select: {
									id: true,
									name: true,
									color: true,
								},
							},
						},
					},
				},
			});
			if (!user || !user.coalition_users || user.coalition_users.length === 0) {
				return res.status(404).send('User not found or not in a coalition');
			}

			// Get the score for the past 30 days per day, 2 points per day (00:00 and 12:00)
			// TODO: change this to the entire current tournament
			const dates: Date[] = [];
			const now = new Date();
			now.setHours((now.getHours() > 12) ? 12 : 0, 0, 0, 0);
			const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			for (let i = 0; i <= 60; i++) {
				dates.push(new Date(monthAgo.getTime() + i * 12 * 60 * 60 * 1000));
			}

			// Get all fixed point types
			const fixedPointTypes = await prisma.codamCoalitionFixedType.findMany({
				select: {
					type: true
				},
				orderBy: {
					type: 'asc',
				},
			});
			// @ts-ignore
			fixedPointTypes.push({ type: null }); // replacement for null

			// Get all scores for this user for the past 30 days
			const scoreSumsPerTypePerDate: { [key: string]: { [key: number]: number } } = {};
			for (const fixedPointType of fixedPointTypes) {
				scoreSumsPerTypePerDate[fixedPointType.type || 'null'] = {};
			}
			for (const date of dates) {
				const scores = await prisma.codamCoalitionScore.groupBy({
					by: ['fixed_type_id'],
					_sum: {
						amount: true,
					},
					where: {
						user_id: user.id,
						created_at: {
							gte: monthAgo,
							lt: date,
						},
					},
				});
				for (const score of scores) {
					scoreSumsPerTypePerDate[score.fixed_type_id || 'null'][date.getTime()] = score._sum.amount || 0;
				}
			}

			// Compose the returnable data (in a format Chart.js can understand)
			const chartJSData: ChartConfiguration = {
				type: 'line',
				data: {
					labels: dates.map((date) => `${date.toLocaleDateString()} ${date.getHours()}:00`),
					datasets: fixedPointTypes.map((fixedPointType) => {
						return {
							label: fixedPointType.type || 'custom',
							data: dates.map(date => scoreSumsPerTypePerDate[fixedPointType.type || 'null'][date.getTime()] || 0),
							// @ts-ignore
							tension: 0.25,
						};
					}),
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
							// hide x-xaxis labels
							ticks: {
								display: false,
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
};
