import { Express } from 'express';
import { PrismaClient } from '@prisma/client';

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
			await prisma.codamCoalitionRanking.create({
				data: {
					type: req.body.name.toLowerCase().replace(/ /g, '_'),
					name: req.body.name,
					description: req.body.description,
					top_title: req.body.top_title,
					bonus_points: parseInt(req.body.bonus_points),
					disabled: req.body.disabled === 'true',
				},
			});
		}
		catch (err) {
			console.error(err);
			return res.status(400).send('Failed to create ranking');
		}

		return res.redirect(`/admin/rankings`);
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
			return res.status(400).send('Missing body parts; required are name, description, top_title, and bonus_points');
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
		}
		catch (err) {
			console.error(err);
			return res.status(400).send('Failed to update ranking');
		}

		return res.redirect(`/admin/rankings`);
	});
};
