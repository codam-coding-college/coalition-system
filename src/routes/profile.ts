import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { ExpressIntraUser } from '../sync/oauth';
import { getUserTournamentRanking } from '../utils';

export const setupProfileRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/profile/:login', async (req, res) => {
		if (req.params.login === 'me') {
			// Redirect to the user's profile page
			const user = req.user as ExpressIntraUser;
			return res.redirect(`/profile/${user.login}`);
		}

		const profileUser = await prisma.intraUser.findFirst({
			where: {
				login: req.params.login,
			},
			include: {
				codam_user: true,
				coalition_users: {
					include: {
						coalition: true,
					},
				}
			},
		});
		if (!profileUser) {
			return res.status(404).send('User not found');
		}

		// TODO: take tournament deadlines into account
		const totalScores = await prisma.codamCoalitionScore.groupBy({
			by: ['fixed_type_id'],
			_sum: {
				amount: true,
			},
			where: {
				user_id: profileUser.id,
			},
		});
		const totalScore = totalScores.reduce((acc, score) => acc + (score._sum.amount ? score._sum.amount : 0), 0);
		const ranking = await getUserTournamentRanking(prisma, profileUser.id);

		// TODO: take tournament deadlines into account
		const latestScores = await prisma.codamCoalitionScore.findMany({
			where: {
				user_id: profileUser.id,
			},
			orderBy: {
				created_at: 'desc',
			},
			take: 50,
			include: {
				coalition: {
					select: {
						intra_coalition: {
							select: {
								name: true,
								color: true,
							},
						}
					}
				},
			},
		});

		return res.render('profile.njk', {
			profileUser,
			latestScores,
			totalScores,
			totalScore,
			ranking,
		});
	});
};
