import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import Fast42 from '@codam/fast42';
import { CAMPUS_ID, INTRA_API_UID, INTRA_API_SECRET, CURSUS_ID } from '../../env';
import { parseTeamInAPISearcher } from '../../utils';

const getAPIClient = async function(): Promise<Fast42> {
	return new Fast42([{
		client_id: INTRA_API_UID,
		client_secret: INTRA_API_SECRET,
	}]).init();
}

const fetchSingleApiPage = async function(api: Fast42, endpoint: string, params: Record<string, string>): Promise<any> {
	const job = await api.get(endpoint, params);
	return await job.json();
}

export const setupAPISearchRoutes = function(app: Express, prisma: PrismaClient): void {

	// LOCATIONS
	// All locations
	app.get('/admin/apisearch/locations', async (req, res) => {
		try {
			const api = await getAPIClient();
			const locations = await fetchSingleApiPage(api, `/campus/${CAMPUS_ID}/locations`, {
				'page[size]': '50',
				'filter[inactive]': 'true',
			});
			return res.json(locations);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// Locations by login
	app.get('/admin/apisearch/locations/login/:login', async (req, res) => {
		try {
			const login = req.params.login;
			const user = await prisma.intraUser.findFirst({
				where: {
					login: login,
				},
				select: {
					id: true,
				},
			});
			if (user === null) {
				return res.status(404).json({ error: 'User not found' });
			}
			const api = await getAPIClient();
			const locations = await fetchSingleApiPage(api, `/users/${user.id}/locations`, {
				'page[size]': '50',
				'filter[inactive]': 'true',
			});
			return res.json(locations);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// Location by ID
	app.get('/admin/apisearch/locations/id/:locationId', async (req, res) => {
		try {
			const locationId = req.params.locationId;
			const api = await getAPIClient();
			const location = await fetchSingleApiPage(api, '/locations/', { // use /locations with filter to make sure the response is in the same format as the other location endpoints
				'filter[id]': locationId,
			});
			return res.json(location);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// PROJECTS (ACTUALLY TEAMS)
	// All projects (teams)
	app.get('/admin/apisearch/projects', async (req, res) => {
		try {
			const api = await getAPIClient();
			const teams = await fetchSingleApiPage(api, `/teams`, {
				'filter[primary_campus]': CAMPUS_ID.toString(),
				'filter[active_cursus]': CURSUS_ID.toString(),
				'filter[with_mark]': 'true',
				'page[size]': '100',
				'sort': '-updated_at'
			});
			const modifiedTeams = await parseTeamInAPISearcher(teams);
			return res.json(modifiedTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// Projects (actually teams) by login
	app.get('/admin/apisearch/projects/login/:login', async (req, res) => {
		try {
			const login = req.params.login;
			const user = await prisma.intraUser.findFirst({
				where: {
					login: login,
				},
				select: {
					id: true,
				},
			});
			if (user === null) {
				return res.status(404).json({ error: 'User not found' });
			}
			const api = await getAPIClient();
			const teams = await fetchSingleApiPage(api, `/users/${user.id}/teams`, {
				'filter[with_mark]': 'true',
				'page[size]': '100',
				'sort': '-updated_at'
			});
			const modifiedTeams = await parseTeamInAPISearcher(teams);
			return res.json(modifiedTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// Projects (actually teams) by team ID
	app.get('/admin/apisearch/projects/id/:teamId', async (req, res) => {
		try {
			const teamId = req.params.teamId;
			const api = await getAPIClient();
			const teams = await fetchSingleApiPage(api, '/teams/', {
				'filter[id]': teamId,
			});
			const modifiedTeams = await parseTeamInAPISearcher(teams);
			return res.json(modifiedTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});
};
