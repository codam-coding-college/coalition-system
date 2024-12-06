import { PrismaClient } from '@prisma/client';
import { ChartConfiguration } from 'chart.js';
import { Express } from 'express';
import { CoalitionScore, getBlocAtDate, getCoalitionScore } from '../utils';

export const setupChartRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/charts/coalitions/scores/history', async (req, res) => {
		try {
			const now = new Date();
			const currentBloc = await getBlocAtDate(prisma, now);
			if (!currentBloc) {
				throw new Error('No season is currently ongoing');
			}
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
			// Get the scores since the beginning of the season, 2 data points per day
			const dates = [];
			const blocStart = currentBloc.begin_at;
			const twelveHourBlocsSinceBlocStart = Math.floor((now.getTime() - blocStart.getTime()) / (12 * 60 * 60 * 1000));
			for (let i = 0; i <= twelveHourBlocsSinceBlocStart; i++) {
				dates.push(new Date(blocStart.getTime() + i * 12 * 60 * 60 * 1000));
			}
			dates.push(now); // always add the current score

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
					labels: dates.map((date) => `${date.toLocaleDateString()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`),
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
			const now = new Date();
			const currentBloc = await getBlocAtDate(prisma, now);
			if (!currentBloc) {
				throw new Error('No season is currently ongoing');
			}
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
			// Get the scores since the beginning of the season, 2 data points per day
			const dataPoints: CoalitionScore[] = [];
			const blocStart = currentBloc.begin_at;
			const twelveHourBlocsSinceBlocStart = Math.floor((now.getTime() - blocStart.getTime()) / (12 * 60 * 60 * 1000));
			for (let i = 0; i < twelveHourBlocsSinceBlocStart; i++) {
				const date = new Date(blocStart.getTime() + i * 12 * 60 * 60 * 1000);
				dataPoints[date.getTime()] = await getCoalitionScore(prisma, coalitionId, date);
			}
			dataPoints[now.getTime()] = await getCoalitionScore(prisma, coalitionId, now); // always add the current score

			// Compose the returnable data (in a format Chart.js can understand)
			const chartJSData: ChartConfiguration = {
				type: 'line',
				data: {
					labels: Object.keys(dataPoints).map((timestamp) => {
						const date = new Date(parseInt(timestamp));
						return `${date.toLocaleDateString()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
					}),
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
			const now = new Date();
			const currentBloc = await getBlocAtDate(prisma, now);
			if (!currentBloc) {
				throw new Error('No season is currently ongoing');
			}

			// Get the scores for this user since the beginning of the season, 2 data points per day
			const dates: Date[] = [];
			const blocStart = currentBloc.begin_at;
			const twelveHourBlocsSinceBlocStart = Math.floor((now.getTime() - blocStart.getTime()) / (12 * 60 * 60 * 1000));
			for (let i = 0; i <= twelveHourBlocsSinceBlocStart; i++) {
				dates.push(new Date(blocStart.getTime() + i * 12 * 60 * 60 * 1000));
			}
			dates.push(now); // always add the current score

			// Get all scores for this user for the given timespan
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
							gte: blocStart,
							lte: date,
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
					labels: dates.map((date) => `${date.toLocaleDateString()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`),
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

			const now = new Date();
			const currentBloc = await getBlocAtDate(prisma, now);
			if (!currentBloc) {
				throw new Error('No season is currently ongoing');
			}

			// Get the scores for this user since the beginning of the season, 2 data points per day
			const dates: Date[] = [];
			const blocStart = currentBloc.begin_at;
			const twelveHourBlocsSinceBlocStart = Math.floor((now.getTime() - blocStart.getTime()) / (12 * 60 * 60 * 1000));
			for (let i = 0; i <= twelveHourBlocsSinceBlocStart; i++) {
				dates.push(new Date(blocStart.getTime() + i * 12 * 60 * 60 * 1000));
			}
			dates.push(now); // always add the current score

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

			// Get all scores for this user for the given timespan
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
							gte: blocStart,
							lte: date,
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
					labels: dates.map((date) => `${date.toLocaleDateString()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`),
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
