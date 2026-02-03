import { Express } from 'express';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import { getRanking } from '../utils';

export const setupRankingRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/rankings/:ranking_type', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async (req, res) => {
		const rankingType = await prisma.codamCoalitionRanking.findUnique({
			where: {
				type: req.params.ranking_type,
			},
		});
		if (!rankingType) {
			return res.status(404).send('Ranking type not found');
		}
		const ranking = await getRanking(prisma, rankingType.type, new Date(), 1000);
		return res.render('ranking.njk', {
			pageranking: ranking,
			rankingTitle: rankingType.name,
			rankingDescription: rankingType.description,
			coalitionColored: true,
		});
	});
};
