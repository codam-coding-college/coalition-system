import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { CURSUS_ID } from '../../env';

export const setupAdminUserRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/users', async (req, res) => {
		return res.render('admin/users.njk');
	});

	app.get('/admin/users/csv', async (req, res) => {
		const now = new Date();
		const users = await prisma.codamUser.findMany({
			where: {
				intra_user: {
					kind: 'student',
					cursus_users: {
						some: {
							cursus_id: CURSUS_ID,
							OR: [
								{ end_at: null },
								{ end_at: { gt: now } }, // also consider users that are still active
							],
						},
					},
				},
			},
			include: {
				intra_user: {
					include: {
						coalition_users: {
							include: {
								coalition: true, // intra_coalition type
							},
						},
					},
				},
			},
		});

		let csv = 'Coalition,User\n';
		for (const user of users) {
			if (user.intra_user.coalition_users.length === 0) {
				csv += `,"${user.intra_user.login}"\n`;
				continue;
			}
			csv += `"${user.intra_user.coalition_users[0].coalition.name}","${user.intra_user.login}"\n`;
		}
		res.setHeader('Content-Disposition', `attachment; filename="coalition-users-export.csv"`);
		res.setHeader('Content-Type', 'text/csv');
		return res.send(csv);
	});
};
