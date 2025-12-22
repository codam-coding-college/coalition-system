import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAPIClient } from '../../utils';
import { NODE_ENV } from '../../env';

export const setupAdminTitleRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/titles', async function(req, res) {
		const titles = await prisma.codamCoalitionTitle.findMany({
			include: {
				title_users: {
					include: {
						user: {
							include: {
								intra_user: {
									select: {
										login: true,
									},
								},
							},
						},
					},
				},
				coalition: {
					include: {
						intra_coalition: {
							select: {
								name: true,
								color: true,
							},
						},
					},
				},
			},
			orderBy: [
				{ coalition_id: 'asc' },
				{ ranking: 'asc' },
			],
		});

		const coalitions = await prisma.codamCoalition.findMany({
			include: {
				intra_coalition: {
					select: {
						name: true,
					},
				},
			}
		});

		res.render('admin/titles.njk', {
			titles,
			coalitions,
		});
	});

	app.post('/admin/titles/new', async function(req, res) {
		if (!req.body.title || !req.body.coalition_id || !req.body.ranking) {
			return res.status(400).send('Missing body parts; required are title, coalition_id, and ranking');
		}

		try {
			let intraTitle = { id: null };
			if (NODE_ENV === 'production') {
				const api = await getAPIClient();
				const post = await api.post('/titles', {
					title: {
						name: req.body.title,
					},
				});
				intraTitle = await post.json();
			}
			const title = await prisma.codamCoalitionTitle.create({
				data: {
					title: req.body.title,
					ranking: parseInt(req.body.ranking),
					intra_title_id: intraTitle.id,
					coalition: {
						connect: {
							id: parseInt(req.body.coalition_id),
						},
					},
				},
			});
			return res.redirect(`/admin/titles/${title.id}/edit`);
		}
		catch (err) {
			console.error(err);
			return res.status(500).send('Failed to create title');
		}
	});

	app.get('/admin/titles/:id/edit', async function(req, res) {
		const title = await prisma.codamCoalitionTitle.findFirst({
			where: {
				id: parseInt(req.params.id),
			},
			include: {
				coalition: {
					include: {
						intra_coalition: {
							select: {
								name: true,
								color: true,
							},
						},
					},
				},
			}
		});
		if (!title) {
			return res.status(404).send('Title not found');
		}

		const coalitions = await prisma.codamCoalition.findMany({
			include: {
				intra_coalition: {
					select: {
						name: true,
					},
				},
			}
		});

		res.render('admin/title_edit.njk', {
			title,
			coalitions,
		});
	});

	app.post('/admin/titles/:id/edit', async function(req, res) {
		const parsedTitleId = parseInt(req.params.id);
		if (isNaN(parsedTitleId)) {
			return res.status(400).send('Invalid title ID');
		}
		const title = await prisma.codamCoalitionTitle.findFirst({
			where: {
				id: parsedTitleId,
			},
			include: {
				coalition: {
					include: {
						intra_coalition: {
							select: {
								name: true,
								color: true,
							},
						},
					},
				},
			},
		});
		if (!title) {
			return res.status(404).send('Title not found');
		}

		if (!req.body.title || !req.body.coalition_id || !req.body.ranking) {
			return res.status(400).send('Missing body parts; required are title, coalition_id, and ranking');
		}

		const coalition = await prisma.codamCoalition.findFirst({
			where: {
				id: parseInt(req.body.coalition_id),
			},
		});
		if (!coalition) {
			return res.status(400).send('Invalid coalition ID');
		}

		try {
			if (NODE_ENV === 'production' && title.intra_title_id) {
				const api = await getAPIClient();
				const patch = await api.patch(`/titles/${title.intra_title_id}`, {
					name: req.body.title,
				});
				if (!patch.ok) {
					throw new Error(`Failed to update Intra title ${title.intra_title_id} for CodamCoalitionTitle ${title.id}, HTTP status ${patch.status} ${patch.statusText}`);
				}
			}
			await prisma.codamCoalitionTitle.update({
				where: {
					id: parsedTitleId,
				},
				data: {
					title: req.body.title,
					ranking: parseInt(req.body.ranking),
					coalition: {
						connect: {
							id: parseInt(req.body.coalition_id),
						},
					},
				},
			});
		}
		catch (err) {
			console.error(err);
			return res.status(500).send('Failed to update title');
		}

		return res.redirect(`/admin/titles`);
	});
};
