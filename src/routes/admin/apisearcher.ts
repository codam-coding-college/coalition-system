import { Express } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
import Fast42 from '@codam/fast42';
import { CAMPUS_ID, CURSUS_ID } from '../../env';
import { getAPIClient, fetchSingleApiPage, parseTeamInAPISearcher, parseScaleTeamInAPISearcher } from '../../utils';

const EXAM_PROJECT_IDS = [1320, 1321, 1322, 1323, 1324];

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
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams);
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
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams);
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
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams);
			return res.json(modifiedTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// EXAMS (ACTUALLY TEAMS TOO)
	// All exams (teams)
	app.get('/admin/apisearch/exams', async (req, res) => {
		try {
			const api = await getAPIClient();
			const teams = await fetchSingleApiPage(api, `/teams`, {
				'filter[primary_campus]': CAMPUS_ID.toString(),
				'filter[active_cursus]': CURSUS_ID.toString(),
				'filter[with_mark]': 'true',
				'filter[project_id]': EXAM_PROJECT_IDS.join(','),
				'page[size]': '100',
				'sort': '-updated_at'
			});
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams);
			return res.json(modifiedTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// Exams (actually teams) by login
	app.get('/admin/apisearch/exams/login/:login', async (req, res) => {
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
				'filter[project_id]': EXAM_PROJECT_IDS.join(','),
				'page[size]': '100',
				'sort': '-updated_at'
			});
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams);
			return res.json(modifiedTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// Exams (actually teams) by team ID
	app.get('/admin/apisearch/exams/id/:teamId', async (req, res) => {
		try {
			const teamId = req.params.teamId;
			const api = await getAPIClient();
			const teams = await fetchSingleApiPage(api, '/teams/', {
				'filter[id]': teamId,
				'filter[project_id]': EXAM_PROJECT_IDS.join(','),
			});
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams);
			return res.json(modifiedTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// EVALUATIONS (SCALE_TEAMS)
	// All evaluations
	app.get('/admin/apisearch/evaluations', async (req, res) => {
		try {
			const api = await getAPIClient();
			const evaluations = await fetchSingleApiPage(api, '/scale_teams', {
				'filter[campus_id]': CAMPUS_ID.toString(),
				'filter[cursus_id]': CURSUS_ID.toString(),
				'filter[future]': 'false',
				'range[filled_at]': `2024-01-01T00:00:00,${new Date().toISOString()}`, // filled_at was only added later
				'page[size]': '25',
				'sort': '-filled_at'
			});
			const modifiedScaleTeams = await parseScaleTeamInAPISearcher(prisma, evaluations);
			return res.json(modifiedScaleTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// Evaluations by the login of a corrector
	app.get('/admin/apisearch/evaluations/corrector/:login', async (req, res) => {
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
			const evaluations = await fetchSingleApiPage(api, '/scale_teams', {
				'filter[campus_id]': CAMPUS_ID.toString(),
				'filter[cursus_id]': CURSUS_ID.toString(),
				'filter[user_id]': user.id.toString(),
				'filter[future]': 'false',
				'range[filled_at]': `2024-01-01T00:00:00,${new Date().toISOString()}`, // filled_at was only added later
				'page[size]': '25',
				'sort': '-filled_at'
			});
			const modifiedScaleTeams = await parseScaleTeamInAPISearcher(prisma, evaluations);
			return res.json(modifiedScaleTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// Evaluations done for a specific team
	app.get('/admin/apisearch/evaluations/team/:teamId', async (req, res) => {
		try {
			const teamId = req.params.teamId;
			const api = await getAPIClient();
			const evaluations = await fetchSingleApiPage(api, '/scale_teams', {
				'filter[team_id]': teamId,
				'filter[future]': 'false',
				'page[size]': '25',
				'sort': '-filled_at'
			});
			const modifiedScaleTeams = await parseScaleTeamInAPISearcher(prisma, evaluations);
			return res.json(modifiedScaleTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// Specific evaluation by ID
	app.get('/admin/apisearch/evaluations/scale_team/:scaleTeamId', async (req, res) => {
		try {
			const scaleTeamId = req.params.scaleTeamId;
			const api = await getAPIClient();
			const evaluations = await fetchSingleApiPage(api, '/scale_teams', {
				'filter[id]': scaleTeamId,
				'filter[future]': 'false',
				'page[size]': '25',
				'sort': '-filled_at'
			});
			const modifiedScaleTeams = await parseScaleTeamInAPISearcher(prisma, evaluations);
			return res.json(modifiedScaleTeams);
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});

	// USERS
	// Actually not using API here! Use internal database.
	const USER_QUERY_DEFAULTS: Prisma.IntraCoalitionUserFindManyArgs<DefaultArgs> = { // type is what the prisma.model.findMany() function expects as parameter
		select: {
			id: true,
			created_at: true,
			updated_at: true,
			user: {
				select: {
					id: true,
					login: true,
					usual_full_name: true,
					image: true,
					created_at: true,
				},
			},
			coalition: {
				select: {
					id: true,
					slug: true,
					name: true,
					color: true,
					image_url: true,
				},
			},
		},
		orderBy: {
			updated_at: 'desc',
		},
	};

	// All users
	app.get('/admin/apisearch/users', async (req, res) => {
		const coalitionUsers = await prisma.intraCoalitionUser.findMany(USER_QUERY_DEFAULTS);
		return res.json(coalitionUsers);
	});

	// Users by login
	app.get('/admin/apisearch/users/login/:login', async (req, res) => {
		const login = req.params.login;
		const coalitionUsers = await prisma.intraCoalitionUser.findMany({
			...USER_QUERY_DEFAULTS,
			where: {
				user: {
					login: login,
				},
			},
		});
		return res.json(coalitionUsers);
	});

	// Users by ID
	app.get('/admin/apisearch/users/id/:userId', async (req, res) => {
		const userId = parseInt(req.params.userId);
		if (isNaN(userId)) {
			return res.status(400).json({ error: 'Invalid user ID' });
		}
		const coalitionUsers = await prisma.intraCoalitionUser.findMany({
			...USER_QUERY_DEFAULTS,
			where: {
				user: {
					id: userId,
				},
			},
		});
		return res.json(coalitionUsers);
	});

	// Users by coalition name / slug
	app.get('/admin/apisearch/users/coalition/:name', async (req, res) => {
		const name = req.params.name;
		// Format name with first letter uppercase and rest lowercase (Intra coalitions are usually named like this)
		const stylizedName = req.params.name.charAt(0).toUpperCase() + req.params.name.slice(1).toLowerCase();
		const coalitionUsers = await prisma.intraCoalitionUser.findMany({
			...USER_QUERY_DEFAULTS,
			where: {
				OR: [
					{
						coalition: {
							name: stylizedName,
						},
					},
					{
						coalition: {
							name: name,
						},
					},
					{
						coalition: {
							slug: {
								contains: name,
							}
						},
					},
				],
			},
		});
		return res.json(coalitionUsers);
	});

	// Users by coalition_user ID
	app.get('/admin/apisearch/users/coalition_user_id/:coalitionUserId', async (req, res) => {
		const coalitionUserId = parseInt(req.params.coalitionUserId);
		if (isNaN(coalitionUserId)) {
			return res.status(400).json({ error: 'Invalid user coalition ID' });
		}
		const coalitionUsers = await prisma.intraCoalitionUser.findMany({
			...USER_QUERY_DEFAULTS,
			where: {
				id: coalitionUserId,
			},
		});
		return res.json(coalitionUsers);
	});
};
