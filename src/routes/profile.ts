import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { ExpressIntraUser } from '../sync/oauth';
import { getUserScores, getUserRankingAcrossAllRankings, getUserTournamentRanking } from '../utils';

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

		const now = new Date();
		const { userScores, totalScore } = await getUserScores(prisma, profileUser.id, now);
		const ranking = await getUserTournamentRanking(prisma, profileUser.id);

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

		// Get user ranking across all rankings
		const userRankings = await getUserRankingAcrossAllRankings(prisma, profileUser.id);

		return res.render('profile.njk', {
			profileUser,
			latestScores,
			userScores,
			totalScore,
			ranking,
			userRankings,
		});
	});
};
