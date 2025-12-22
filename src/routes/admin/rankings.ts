import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAPIClient } from '../../utils';
import { NODE_ENV } from '../../env';

export const setupAdminRankingRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/rankings', async function(req, res) {
		const rankings = await prisma.codamCoalitionRanking.findMany({
			include: {
				fixed_types: true,
			},
			orderBy: {
				type: 'asc',
			},
		});
		res.render('admin/rankings.njk', {
			rankings,
		});
	});

	app.post('/admin/rankings/new', async function(req, res) {
		if (!req.body.name || !req.body.description || !req.body.top_title || !req.body.bonus_points) {
			return res.status(400).send('Missing body parts; required are type, name, description, top_title and bonus_points');
		}

		try {
			if (req.body.top_title && !req.body.top_title.includes('%login')) {
				return res.status(400).send("Top title must include '%login' placeholder for the user's login");
			}

			const ranking = await prisma.codamCoalitionRanking.create({
				data: {
					type: req.body.name.toLowerCase().replace(/ /g, '_'),
					name: req.body.name,
					description: req.body.description,
					top_title: req.body.top_title,
					bonus_points: parseInt(req.body.bonus_points),
					disabled: req.body.disabled === 'true',
				},
			});

			if (NODE_ENV === 'production') {
				// Create Intra title
				try {
					const api = await getAPIClient();
					const post = await api.post('/titles', {
						title: {
							name: ranking.top_title,
						},
					});
					if (!post.ok) {
						throw new Error(`Intra API returned status ${post.status} during ranking title creation for ranking ${ranking.name}`);
					}
					const intraTitle = await post.json();
					await prisma.codamCoalitionRanking.update({
						where: {
							type: ranking.type,
						},
						data: {
							top_title_intra_id: intraTitle.id,
						},
					});
				}
				catch (err) {
					console.error(`Failed to create Intra title for ranking ${ranking.name}:`, err);
				}
			}

			return res.redirect(`/admin/rankings/${ranking.type}/edit`);
		}
		catch (err) {
			console.error(err);
			return res.status(400).send('Failed to create ranking');
		}
	});

	app.get('/admin/rankings/:type/edit', async function(req, res) {
		const ranking = await prisma.codamCoalitionRanking.findFirst({
			where: {
				type: req.params.type,
			},
			include: {
				fixed_types: true,
			}
		});
		if (!ranking) {
			return res.status(404).send('Ranking not found');
		}

		const fixedPointTypes = await prisma.codamCoalitionFixedType.findMany({
			orderBy: {
				type: 'asc',
			}
		});

		const selectedFixedPointTypes = ranking.fixed_types.map((type) => type.type);

		res.render('admin/ranking_edit.njk', {
			ranking,
			fixedPointTypes,
			selectedFixedPointTypes,
		});
	});

	app.post('/admin/rankings/:type/edit', async function(req, res) {
		const ranking = await prisma.codamCoalitionRanking.findFirst({
			where: {
				type: req.params.type,
			},
			include: {
				fixed_types: true,
			}
		});
		if (!ranking) {
			return res.status(404).send('Ranking not found');
		}

		if (!req.body.name || !req.body.description || !req.body.top_title || !req.body.bonus_points || !req.body.fixed_types) {
			return res.status(400).send('Missing body parts; required are name, description, top_title, bonus_points and fixed_types');
		}

		if (!req.body.top_title.includes('%login')) {
			return res.status(400).send("Top title must include '%login' placeholder for the user's login");
		}

		if (typeof req.body.fixed_types === 'string') {
			// Convert to array when only 1 type is selected
			req.body.fixed_types = [req.body.fixed_types];
		}

		for (const type of req.body.fixed_types) {
			const typeExists = await prisma.codamCoalitionFixedType.findFirst({
				where: {
					type: type,
				},
			});
			if (!typeExists) {
				return res.status(400).send(`Fixed type ${type} does not exist`);
			}
		}

		try {
			await prisma.codamCoalitionRanking.update({
				where: {
					type: req.params.type,
				},
				data: {
					name: req.body.name,
					description: req.body.description,
					top_title: req.body.top_title,
					bonus_points: parseInt(req.body.bonus_points),
					disabled: req.body.disabled === 'true',
					fixed_types: {
						disconnect: ranking.fixed_types.map((type) => {
							return {
								type: type.type,
							};
						}, {}),
						connect: req.body.fixed_types.map((type: string) => {
							return {
								type,
							};
						}, {}),
					},
				},
			});

			if (NODE_ENV === 'production' && ranking.top_title_intra_id) {
				// Update Intra title
				try {
					const api = await getAPIClient();
					const patch = await api.patch(`/titles/${ranking.top_title_intra_id}`, {
						title: {
							name: ranking.top_title,
						},
					});
					if (!patch.ok) {
						throw new Error(`Intra API returned status ${patch.status} during ranking title modification for ranking ${ranking.name}`);
					}
				}
				catch (err) {
					console.error(`Failed to update Intra title for ranking ${ranking.name}:`, err);
				}
			}
		}
		catch (err) {
			console.error(err);
			return res.status(400).send('Failed to update ranking');
		}

		return res.redirect(`/admin/rankings`);
	});
};
