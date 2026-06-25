import { Express } from 'express';
import passport from 'passport';
import { CodamCoalition, PrismaClient } from '@prisma/client';
import { isQuizAvailable } from './quiz';
import { ExpressIntraUser } from '../sync/oauth';
import { getCoalitionScore, CoalitionScore, getRanking, SingleRanking, getBlocAtDate, bonusPointsAwardingStarted } from '../utils';

export const setupHomeRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async (req, res) => {
		const user = req.user as ExpressIntraUser;
		const now = new Date();

		// Get all coalitions
		const coalitions = await prisma.codamCoalition.findMany({
			select: {
				id: true,
				description: true,
				tagline: true,
				intra_coalition: {
					select: {
						id: true,
						name: true,
						color: true,
						image_url: true,
						cover_url: true,
					}
				}
			}
		});

		// Map all coalitions to their id
		const coalitionsObject: { [key: number]: CodamCoalition } = {};
		for (const coalition of coalitions) {
			coalitionsObject[coalition.id] = coalition;
		}

		// Get current scores per coalition
		const coalitionScores: { [key: number]: CoalitionScore } = {};
		for (const coalition of coalitions) {
			coalitionScores[coalition.id] = await getCoalitionScore(prisma, coalition.id);
		}

		// Sort the coalitions by score
		const sortedCoalitionScores = Object.entries(coalitionScores).sort((a, b) => b[1].score - a[1].score);

		// Get current bloc deadline
		const currentBlocDeadline = await getBlocAtDate(prisma);
		const nextBlocDeadline = await prisma.intraBlocDeadline.findFirst({
			orderBy: {
				begin_at: 'asc',
			},
			where: {
				begin_at: {
					gt: now,
				},
			},
		});

		// Get the coalition of the current user
		const my_coalition = await prisma.intraCoalitionUser.findFirst({
			where: {
				user_id: user.id,
			},
			select: {
				coalition: {
					select: {
						id: true,
						name: true,
						color: true,
						image_url: true,
						codam_coalition: {
							select: {
								description: true,
								tagline: true,
							},
						},
					},
				},
			},
		});

		// Get rankings
		const rankingTypes = await prisma.codamCoalitionRanking.findMany({
			select: {
				type: true,
				name: true,
				description: true,
				bonus_points: true,
			},
			orderBy: {
				type: 'asc',
			},
			where: {
				disabled: false,
			},
		});
		const rankings: { [key: string]: SingleRanking[] } = {};
		for (const rankingType of rankingTypes) {
			rankings[rankingType.type] = await getRanking(prisma, rankingType.type);
		}

		// Check if bonus points awarding for rankings has started (7 days prior to end of the bloc)
		const bonusPointsAwarding = await bonusPointsAwardingStarted(prisma, now);
		const rankingBonusPoints: { [key: string]: {
			total: number;
			awarded: number;
			remaining: number;
			perHour: number;
		} } = {};
		if (bonusPointsAwarding.startTime && bonusPointsAwarding.started) {
			// Calculate how many bonus points are left to award per ranking type
			for (const rankingType of rankingTypes) {
				const totalBonusPoints = rankingType.bonus_points;
				if (!totalBonusPoints || totalBonusPoints <= 0) {
					continue;
				}
				const bonusPointsPerHour = Math.floor(totalBonusPoints / (7 * 24));
				// Bonus points are awarded every hour during the last 7 days
				let awardedBonusPoints = 0;
				for (let dt = new Date(bonusPointsAwarding.startTime); dt < now; dt.setHours(dt.getHours() + 1)) {
					awardedBonusPoints += bonusPointsPerHour;
				}
				const remainingBonusPoints = totalBonusPoints - awardedBonusPoints;
				rankingBonusPoints[rankingType.type] = {
					total: totalBonusPoints,
					awarded: Math.min(awardedBonusPoints, totalBonusPoints),
					remaining: Math.max(remainingBonusPoints, 0),
					perHour: bonusPointsPerHour,
				};
			}
		}
		else {
			// No bonus points have been awarded yet
			for (const rankingType of rankingTypes) {
				const totalBonusPoints = rankingType.bonus_points;
				if (!totalBonusPoints || totalBonusPoints <= 0) {
					continue;
				}
				rankingBonusPoints[rankingType.type] = {
					total: totalBonusPoints,
					awarded: 0,
					remaining: totalBonusPoints,
					perHour: Math.floor(totalBonusPoints / (7 * 24))
				};
			}
		}

		// Check if quiz is currently available
		const quiz_available = await isQuizAvailable(user, prisma);

		return res.render('home.njk', {
			coalitions,
			coalitionsObject,
			my_coalition,
			now,
			currentBlocDeadline,
			nextBlocDeadline,
			quiz_available,
			sortedCoalitionScores,
			rankingTypes,
			rankings,
			bonusPointsAwarding,
			rankingBonusPoints,
		});
	});
};
