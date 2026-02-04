import { PrismaClient } from '@prisma/client';
import { Express } from 'express';
import { getEndedSeasons, getSeasonResults, RANKING_MAX } from '../utils';

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
			seasonId: season.id,
			endedSeasons,
			season,
			seasonResults,
			rankings,
		});
	});

	app.get('/results/:bloc_deadline_id/coalitions/:coalition_slug', async (req, res) => {
		const endedSeasons = await getEndedSeasons(prisma);
		const season = endedSeasons.find(season => season.id === parseInt(req.params.bloc_deadline_id, 10));
		if (!season) {
			return res.status(404).send('Season not found or has not ended yet.');
		}

		const { seasonResults } = await getSeasonResults(prisma, season.id, RANKING_MAX);
		const seasonResult = seasonResults.find(result => result.coalition.intra_coalition.slug === req.params.coalition_slug);
		if (!seasonResult) {
			return res.status(404).send('Coalition not found for this season.');
		}

		return res.render('ranking.njk', {
			pageranking: seasonResult.scores.map((entry, index) => ({ // Transform to match ranking.njk expected format
				rankingName: `${seasonResult.coalition.intra_coalition.name} Leaderboards - Season ${season.id}`,
				user: entry.user.intra_user,
				coalition: seasonResult.coalition,
				score: entry.score,
				rank: entry.coalition_rank,
			})),
			rankingTitle: `${seasonResult.coalition.intra_coalition.name} Leaderboards - Season ${season.id}`,
			coalitionColored: false,
		});
	});

	app.get('/results/:bloc_deadline_id/coalitions/:coalition_slug/csv', async (req, res) => {
		const endedSeasons = await getEndedSeasons(prisma);
		const season = endedSeasons.find(season => season.id === parseInt(req.params.bloc_deadline_id, 10));
		if (!season) {
			return res.status(404).send('Season not found or has not ended yet.');
		}

		const { seasonResults } = await getSeasonResults(prisma, season.id, RANKING_MAX);
		const seasonResult = seasonResults.find(result => result.coalition.intra_coalition.slug === req.params.coalition_slug);
		if (!seasonResult) {
			return res.status(404).send('Coalition not found for this season.');
		}

		// Generate CSV
		let csv = 'Coalition,Rank,User,Score\n';
		seasonResult.scores.forEach((entry, index) => {
			csv += `"${seasonResult.coalition.intra_coalition.name}",${entry.coalition_rank},"${entry.user.intra_user.login}",${entry.score}\n`;
		});

		res.setHeader('Content-Disposition', `attachment; filename="${seasonResult.coalition.intra_coalition.slug}-leaderboard-season-${season.id}.csv"`);
		res.setHeader('Content-Type', 'text/csv');
		return res.send(csv);
	});

	app.get('/results/:bloc_deadline_id/rankings/:ranking_type', async (req, res) => {
		const endedSeasons = await getEndedSeasons(prisma);
		const season = endedSeasons.find(season => season.id === parseInt(req.params.bloc_deadline_id, 10));
		if (!season) {
			return res.status(404).send('Season not found or has not ended yet.');
		}

		const { seasonResults, rankings } = await getSeasonResults(prisma, season.id, RANKING_MAX);
		const ranking = rankings.find(r => r.type === req.params.ranking_type);
		if (!ranking) {
			return res.status(404).send('Ranking not found for this season.');
		}

		return res.render('ranking.njk', {
			pageranking: ranking.results.map((entry, index) => ({ // Transform to match ranking.njk expected format
				rankingName: ranking.name,
				user: entry.user.intra_user,
				coalition: entry.coalition ? entry.coalition.intra_coalition : null,
				score: entry.score,
				rank: entry.rank,
			})),
			rankingTitle: `${ranking.name} - Season ${season.id}`,
			rankingDescription: ranking.description,
			coalitionColored: true,
		});
	});

	app.get('/results/:bloc_deadline_id/rankings/:ranking_type/csv', async (req, res) => {
		const endedSeasons = await getEndedSeasons(prisma);
		const season = endedSeasons.find(season => season.id === parseInt(req.params.bloc_deadline_id, 10));
		if (!season) {
			return res.status(404).send('Season not found or has not ended yet.');
		}

		const { seasonResults, rankings } = await getSeasonResults(prisma, season.id, RANKING_MAX);
		const ranking = rankings.find(r => r.type === req.params.ranking_type);
		if (!ranking) {
			return res.status(404).send('Ranking not found for this season.');
		}

		// Generate CSV
		let csv = 'Ranking,Coalition,Rank,User,Score\n';
		ranking.results.forEach((entry) => {
			const userCoalition = seasonResults.find(sr => sr.coalition.id === entry.coalition_id);
			const coalitionName = userCoalition ? userCoalition.coalition.intra_coalition.name : 'N/A';
			csv += `"${ranking.name}","${coalitionName}",${entry.rank},"${entry.user.intra_user.login}",${entry.score}\n`;
		});


		res.setHeader('Content-Disposition', `attachment; filename="ranking-${ranking.type}-season-${season.id}.csv"`);
		res.setHeader('Content-Type', 'text/csv');
		return res.send(csv);
	});
};
