import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { getUserScores, getUserRankingAcrossAllRankings, getUserTournamentRanking, getEndedSeasons, getSeasonResults } from '../utils';

export const setupResultsRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/results', async (req, res) => {
		// Redirect to the latest (ended) bloc deadline results page
		const endedSeasons = await getEndedSeasons(prisma);
		if (endedSeasons.length > 0) {
			return res.redirect(`/results/${endedSeasons[0].id}`);
		}
		return res.status(404).send('No previous seasons have ended yet. Come back later!');
	});

	app.get('/results/:bloc_deadline_id', async (req, res) => {
		const endedSeasons = await getEndedSeasons(prisma);
		const season = endedSeasons.find(season => season.id === parseInt(req.params.bloc_deadline_id, 10));
		if (!season) {
			return res.status(404).send('Season not found or has not ended yet.');
		}

		const { seasonResults, rankings } = await getSeasonResults(prisma, season.id, 10);

		return res.render('results.njk', {
			endedSeasons,
			season,
			seasonResults,
			rankings,
		});
	});
};
