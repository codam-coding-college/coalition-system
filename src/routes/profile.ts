import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { ExpressIntraUser } from '../sync/oauth';
import { getUserScores, getUserRankingAcrossAllRankings, getUserSeasonRanking, SMALL_CONTRIBUTION_TYPES } from '../utils';
import NodeCache from 'node-cache';

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
		const ranking = await getUserSeasonRanking(prisma, profileUser.id);

		const latestScores = await prisma.codamCoalitionScore.findMany({
			where: {
				user_id: profileUser.id,
			},
			orderBy: {
				created_at: 'desc',
			},
			take: 100,
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

		const latestBigScores = await prisma.codamCoalitionScore.findMany({
			where: {
				user_id: profileUser.id,
				OR: [
					{
						NOT: {
							fixed_type_id: {
								in: SMALL_CONTRIBUTION_TYPES, // Exclude usually low individual scores
							}
						},
					},
					{
						fixed_type_id: null, // Do include scores that are not fixed types
					}
				],
				amount: {
					gt: 0,
				},
			},
			orderBy: {
				created_at: 'desc',
			},
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
			take: 25,
		});

		// Get user ranking across all rankings
		const userRankings = await getUserRankingAcrossAllRankings(prisma, profileUser.id);

		return res.render('profile.njk', {
			profileUser,
			latestScores,
			latestBigScores,
			userScores,
			totalScore,
			ranking,
			userRankings,
		});
	});

	const autocompleteCache = new NodeCache({ stdTTL: 60 * 5, checkperiod: 60 * 5 });

	app.get('/search/profile/autocomplete', async (req, res) => {
		// Prepare and validate query
		const query = req.query.q;
		if (typeof query !== 'string') {
			return res.status(400).json({ error: 'Invalid query parameter' });
		}
		const trimmedQuery = query.trim();
		if (!trimmedQuery || trimmedQuery.length < 1) {
			return res.json({ data: [] });
		}

		// Check cache first
		const cachedResult = autocompleteCache.get<string[]>(trimmedQuery);
		if (cachedResult) {
			return res.json(cachedResult);
		}

		// Query database
		const users = await prisma.intraUser.findMany({
			where: {
				OR: [
					{
						login: {
							startsWith: trimmedQuery,
							mode: 'insensitive',
						},
					},
					{
						usual_full_name: {
							contains: trimmedQuery,
							mode: 'insensitive',
						},
					},
				]
			},
			select: {
				login: true,
			},
			take: 10,
			orderBy: {
				login: 'asc',
			},
		});

		// Update cache
		const responseUsers = [...users.map(u => u.login)];
		autocompleteCache.set(trimmedQuery, responseUsers);

		// Return results
		return res.json(responseUsers);
	});
};
