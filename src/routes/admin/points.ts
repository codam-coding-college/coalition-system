import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

export const setupAdminPointsRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/points/history', async (req, res) => {
		// Retrieve all scores
		const scores = await prisma.codamCoalitionScore.findMany({
			select: {
				id: true,
				intra_score_id: true,
				amount: true,
				reason: true,
				created_at: true,
				fixed_type_id: true,
				type_intra_id: true,
				coalition_id: true,
				coalition: false,
				fixed_type: false,
				user: {
					select: {
						intra_user: {
							select: {
								login: true,
							}
						}
					},
				},
			},
			orderBy: {
				created_at: 'desc',
			},
		});

		// Retrieve all coalitions
		const coalitionRows = await prisma.codamCoalition.findMany({
			select: {
				intra_coalition: true,
			},
		});

		// Create a map of coalition id to coalition object
		const coalitions: { [key: number]: any } = {};
		for (const row of coalitionRows) {
			coalitions[row.intra_coalition.id] = row;
		}

		return res.render('admin/points/history.njk', {
			scores,
			coalitions,
		});
	});

	app.get('/admin/points/manual', async (req, res) => {
		// Retrieve all fixed point types
		const fixedPointTypes = await prisma.codamCoalitionFixedType.findMany({
			select: {
				type: true, // type is the name of the point type and is unique
			},
			orderBy: {
				type: 'asc',
			},
		});

		return res.render('admin/points/manual.njk', {
			fixedPointTypes,
		});
	});

	app.get('/admin/points/manual/:type', async (req, res) => {
		const type = req.params.type;
		if (type == "custom") {
			return res.render('admin/points/manual/custom.njk', {
				manual_type: type,
				fixedPointType: null,
			});
		}

		const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
			where: {
				type: type,
			},
		});

		if (!fixedPointType) {
			return res.status(404).send('Point type not found');
		}

		if (type.indexOf('/') > -1 || type.indexOf('\\') > -1 || type.indexOf('..') > -1 || type.indexOf(' ') > -1) {
			// some extra sense of security
			return res.status(400).send('Invalid point type');
		}

		if (fs.existsSync(`templates/admin/points/manual/${type}.njk`)) {
			return res.render(`admin/points/manual/${type}.njk`, {
				manual_type: type,
				fixedPointType,
			});
		}
		else {
			return res.status(501).send('Not implemented');
		}
	});

	app.get('/admin/points/automatic', async (req, res) => {
		// Retrieve all fixed point types
		const fixedPointTypes = await prisma.codamCoalitionFixedType.findMany({
			select: {
				type: true, // type is the name of the point type and is unique
				description: true,
				point_amount: true,
			},
			orderBy: {
				type: 'asc',
			},
		});

		return res.render('admin/points/automatic.njk', {
			fixedPointTypes,
		});
	});

	app.get('/admin/points/automatic/:type/edit', async (req, res) => {
		const type = req.params.type;
		const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
			where: {
				type: type,
			},
		});

		if (fixedPointType === null) {
			return res.status(404).send('Point type not found');
		}

		return res.render('admin/points/automatic_edit.njk', {
			fixedPointType,
		});
	});

	app.post('/admin/points/automatic/:type/edit', async (req, res) => {
		const type = req.params.type;
		const pointAmount = parseInt(req.body.point_amount);

		if (isNaN(pointAmount) || pointAmount < 0) { // 0 is allowed, means disabled
			return res.status(400).send('Invalid point amount');
		}

		const fixedPointType = await prisma.codamCoalitionFixedType.update({
			where: {
				type: type,
			},
			data: {
				point_amount: pointAmount,
			},
		});

		// TODO: add system to update all users' points based on this type
		// in the current tournament (optional choice in the form, not by default enabled)

		return res.redirect('/admin/points/automatic');
	});
};
