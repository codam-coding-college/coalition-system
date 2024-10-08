import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { CURSUS_ID } from '../../env';

export const setupAdminCoalitionRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/coalitions', async (req, res) => {
		// Get coalitions
		const coalitions = await prisma.codamCoalition.findMany({
			select: {
				id: true,
				tagline: true,
				description: true,
				intra_coalition: true,
			},
			orderBy: {
				id: 'asc',
			},
		});

		// Get bloc id
		const bloc = await prisma.intraBloc.findFirst({
			select: {
				id: true,
			},
			where: {
				cursus_id: CURSUS_ID
			}
		});
		if (!bloc) {
			return res.status(500).json({ error: 'Bloc not found' });
		}

		return res.render('admin/coalitions.njk', {
			coalitions,
			bloc_id: bloc.id,
		});
	});

	app.post('/admin/coalitions/:coalition_id/edit', async (req, res) => {
		// Only allow editing of tagline and description (for now)
		const { tagline, description } = req.body;
		const coalition_id = Number(req.params.coalition_id);
		if (isNaN(coalition_id)) {
			return res.status(400).json({ error: 'Invalid coalition id' });
		}

		await prisma.codamCoalition.update({
			where: {
				id: coalition_id,
			},
			data: {
				tagline,
				description,
			},
		});

		return res.redirect(`/admin/coalitions/#coalition-${coalition_id}`);
	});
};
