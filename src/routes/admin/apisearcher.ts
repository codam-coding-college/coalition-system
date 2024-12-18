import { Express } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
import { CAMPUS_ID, CURSUS_ID } from '../../env';
import { getAPIClient, fetchSingleApiPage, parseTeamInAPISearcher, parseScaleTeamInAPISearcher, getPageNumber, getOffset } from '../../utils';

const EXAM_PROJECT_IDS = [1320, 1321, 1322, 1323, 1324];

// Response interface
export interface APISearchResponse {
	data: any[];
	meta: {
		pagination: {
			total: number;
			pages: number;
			page: number;
			per_page: number;
		};
	};
};

// Cache for the API searcher specifically
import NodeCache from 'node-cache';
const apiSearcherCache = new NodeCache({ stdTTL: 60 * 5, checkperiod: 60 * 5 });

// Filters applied to locations
export const API_DEFAULT_FILTERS_LOCATIONS = {
	'filter[inactive]': 'true',
};

// Filters applied to teams
export const API_DEFAULT_FILTERS_PROJECTS = {
	'filter[primary_campus]': CAMPUS_ID.toString(),
	'filter[active_cursus]': CURSUS_ID.toString(),
	'filter[with_mark]': 'true',
	'sort': '-updated_at',
};

// Filters applied to teams
export const API_DEFAULT_FILTERS_EXAMS = {
	...API_DEFAULT_FILTERS_PROJECTS,
	'filter[project_id]': EXAM_PROJECT_IDS.join(','),
};

// Filters applied to scale_teams
export const API_DEFAULT_FILTERS_SCALE_TEAMS = {
	'filter[campus_id]': CAMPUS_ID.toString(),
	'filter[cursus_id]': CURSUS_ID.toString(),
	'filter[future]': 'false',
	'range[filled_at]': `2024-01-01T00:00:00,${new Date().toISOString()}`, // filled_at was only added later
	'sort': '-filled_at',
};

// Filters applied to events
export const API_DEFAULT_FILTERS_EVENTS = {
	'sort': '-begin_at',
};

const getPaginationMeta = function(headers: any): APISearchResponse['meta']['pagination'] {
	return {
		total: parseInt(headers['x-total']),
		pages: Math.ceil(parseInt(headers['x-total']) / parseInt(headers['x-per-page'])),
		page: parseInt(headers['x-page']),
		per_page: parseInt(headers['x-per-page']),
	};
};

export const setupAPISearchRoutes = function(app: Express, prisma: PrismaClient): void {

	// LOCATIONS
	// All locations
	app.get('/admin/apisearch/locations', async (req, res) => {
		try {
			const itemsPerPage = 50;
			const pageNum = getPageNumber(req, NaN);
			const api = await getAPIClient();
			const locations = await fetchSingleApiPage(api, `/campus/${CAMPUS_ID}/locations`, {
				...API_DEFAULT_FILTERS_LOCATIONS,
				'page[size]': itemsPerPage.toString(),
			}, pageNum);
			return res.json({
				data: locations.data,
				meta: {
					pagination: getPaginationMeta(locations.headers),
				},
			});
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
			const itemsPerPage = 50;
			const pageNum = getPageNumber(req, NaN);
			const api = await getAPIClient();
			const locations = await fetchSingleApiPage(api, `/users/${user.id}/locations`, {
				...API_DEFAULT_FILTERS_LOCATIONS,
				'page[size]': itemsPerPage.toString(),
			}, pageNum);
			return res.json({
				data: locations.data,
				meta: {
					pagination: getPaginationMeta(locations.headers),
				},
			});
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
			return res.json({
				data: location.data,
				meta: {
					pagination: getPaginationMeta(location.headers),
				},
			});
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
			const itemsPerPage = 100;
			const pageNum = getPageNumber(req, NaN);
			const api = await getAPIClient();
			const teams = await fetchSingleApiPage(api, `/teams`, {
				...API_DEFAULT_FILTERS_PROJECTS,
				'page[size]': itemsPerPage.toString(),
			}, pageNum);
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams.data);
			return res.json({
				data: modifiedTeams,
				meta: {
					pagination: getPaginationMeta(teams.headers),
				},
			});
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
			const itemsPerPage = 100;
			const pageNum = getPageNumber(req, NaN);
			const api = await getAPIClient();
			const teams = await fetchSingleApiPage(api, `/users/${user.id}/teams`, {
				...API_DEFAULT_FILTERS_PROJECTS,
				'page[size]': itemsPerPage.toString(),
			}, pageNum);
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams.data);
			return res.json({
				data: modifiedTeams,
				meta: {
					pagination: getPaginationMeta(teams.headers),
				},
			});
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
			const itemsPerPage = 50;
			const pageNum = getPageNumber(req, NaN);
			const api = await getAPIClient();
			const teams = await fetchSingleApiPage(api, '/teams/', {
				'filter[id]': teamId,
				'page[size]': itemsPerPage.toString(),
			}, pageNum);
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams.data);
			return res.json({
				data: modifiedTeams,
				meta: {
					pagination: getPaginationMeta(teams.headers),
				},
			});
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
			const itemsPerPage = 100;
			const pageNum = getPageNumber(req, NaN);
			const teams = await fetchSingleApiPage(api, `/teams`, {
				...API_DEFAULT_FILTERS_EXAMS,
				'page[size]': itemsPerPage.toString(),
			});
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams.data);
			return res.json({
				data: modifiedTeams,
				meta: {
					pagination: getPaginationMeta(teams.headers),
				},
			});
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
			const itemsPerPage = 100;
			const pageNum = getPageNumber(req, NaN);
			const teams = await fetchSingleApiPage(api, `/users/${user.id}/teams`, {
				...API_DEFAULT_FILTERS_EXAMS,
				'page[size]': itemsPerPage.toString(),
			}, pageNum);
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams.data);
			return res.json({
				data: modifiedTeams,
				meta: {
					pagination: getPaginationMeta(teams.headers),
				},
			});
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
			const itemsPerPage = 50;
			const pageNum = getPageNumber(req, NaN);
			const api = await getAPIClient();
			const teams = await fetchSingleApiPage(api, '/teams/', {
				'filter[id]': teamId,
				'filter[project_id]': EXAM_PROJECT_IDS.join(','),
				'page[size]': itemsPerPage.toString(),
			}, pageNum);
			const modifiedTeams = await parseTeamInAPISearcher(prisma, teams.data);
			return res.json({
				data: modifiedTeams,
				meta: {
					pagination: getPaginationMeta(teams.headers),
				},
			});
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
			const itemsPerPage = 10;
			const pageNum = getPageNumber(req, NaN);
			const api = await getAPIClient();
			const evaluations = await fetchSingleApiPage(api, '/scale_teams', {
				...API_DEFAULT_FILTERS_SCALE_TEAMS,
				'page[size]': itemsPerPage.toString(),
			}, pageNum);
			const modifiedScaleTeams = await parseScaleTeamInAPISearcher(prisma, evaluations.data);
			return res.json({
				data: modifiedScaleTeams,
				meta: {
					pagination: getPaginationMeta(evaluations.headers),
				},
			});
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
			const itemsPerPage = 10;
			const pageNum = getPageNumber(req, NaN);
			const api = await getAPIClient();
			const evaluations = await fetchSingleApiPage(api, '/scale_teams', {
				...API_DEFAULT_FILTERS_SCALE_TEAMS,
				'page[size]': itemsPerPage.toString(),
				'filter[user_id]': user.id.toString(),
			}, pageNum);
			const modifiedScaleTeams = await parseScaleTeamInAPISearcher(prisma, evaluations.data);
			return res.json({
				data: modifiedScaleTeams,
				meta: {
					pagination: getPaginationMeta(evaluations.headers),
				},
			});
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
			const itemsPerPage = 10;
			const pageNum = getPageNumber(req, NaN);
			const api = await getAPIClient();
			const evaluations = await fetchSingleApiPage(api, '/scale_teams', {
				'filter[team_id]': teamId,
				'filter[future]': 'false',
				'page[size]': itemsPerPage.toString(),
				'sort': '-filled_at'
			}, pageNum);
			const modifiedScaleTeams = await parseScaleTeamInAPISearcher(prisma, evaluations.data);
			return res.json({
				data: modifiedScaleTeams,
				meta: {
					pagination: getPaginationMeta(evaluations.headers),
				},
			});
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
			const itemsPerPage = 10;
			const pageNum = getPageNumber(req, NaN);
			const api = await getAPIClient();
			const evaluations = await fetchSingleApiPage(api, '/scale_teams', {
				'filter[id]': scaleTeamId,
				'filter[future]': 'false',
				'page[size]': itemsPerPage.toString(),
				'sort': '-filled_at'
			}, pageNum);
			const modifiedScaleTeams = await parseScaleTeamInAPISearcher(prisma, evaluations.data);
			return res.json({
				data: modifiedScaleTeams,
				meta: {
					pagination: getPaginationMeta(evaluations.headers),
				},
			});
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
		where: {
			user: {
				cursus_users: {
					some: {
						cursus_id: CURSUS_ID,
						end_at: null,
					},
				},
			},
		}
	};

	// All users
	app.get('/admin/apisearch/users', async (req, res) => {
		const itemsPerPage = 50;
		const pageNum = getPageNumber(req, NaN);
		const offset = getOffset(pageNum, itemsPerPage);
		// @ts-ignore
		const totalCoalitionUsers = await prisma.intraCoalitionUser.count({
			where: USER_QUERY_DEFAULTS.where,
		});
		const coalitionUsers = await prisma.intraCoalitionUser.findMany({
			...USER_QUERY_DEFAULTS,
			take: itemsPerPage,
			skip: offset,
		});
		return res.json({
			data: coalitionUsers,
			meta: {
				pagination: {
					total: totalCoalitionUsers,
					pages: Math.ceil(totalCoalitionUsers / itemsPerPage),
					page: pageNum,
					per_page: itemsPerPage,
				},
			},
		});
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
		return res.json({
			data: coalitionUsers,
			meta: {
				pagination: {
					total: coalitionUsers.length,
					pages: 1,
					page: 1,
					per_page: coalitionUsers.length,
				},
			},
		});
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
		return res.json({
			data: coalitionUsers,
			meta: {
				pagination: {
					total: coalitionUsers.length,
					pages: 1,
					page: 1,
					per_page: coalitionUsers.length,
				},
			},
		});
	});

	// Users by coalition name / slug
	app.get('/admin/apisearch/users/coalition/:name', async (req, res) => {
		const name = req.params.name;
		const itemsPerPage = 50;
		const pageNum = getPageNumber(req, NaN);
		const offset = getOffset(pageNum, itemsPerPage);
		if (name.toLowerCase() === 'none' || name.toLowerCase() === 'null') {
			console.log("Fetching users without coalition");
			const nonExistingCoalitionUsers = [];
			const whereQuery = {
				...(USER_QUERY_DEFAULTS.where?.user),
				coalition_users: {
					none: {},
				},
			};

			const totalUsersWithoutCoalition = await prisma.intraUser.count({
				where: whereQuery,
			});
			const usersWithoutCoalition = await prisma.intraUser.findMany({
				// @ts-ignore
				select: (USER_QUERY_DEFAULTS.select?.user)?.select,
				where: whereQuery,
				orderBy: {
					created_at: 'desc',
				},
				take: itemsPerPage,
				skip: offset,
			});
			for (const user of usersWithoutCoalition) {
				// Should be similar to an IntraCoalitionUser object, but then with null values.
				nonExistingCoalitionUsers.push({
					id: null,
					created_at: null,
					updated_at: null,
					user: user,
					coalition: null,
				});
			}
			return res.json({
				data: nonExistingCoalitionUsers,
				meta: {
					pagination: {
						total: totalUsersWithoutCoalition,
						pages: Math.ceil(totalUsersWithoutCoalition / itemsPerPage),
						page: pageNum,
						per_page: itemsPerPage,
					},
				},
			});
		}
		else {
			// Format name with first letter uppercase and rest lowercase (Intra coalitions are usually named like this)
			const stylizedName = req.params.name.charAt(0).toUpperCase() + req.params.name.slice(1).toLowerCase();
			const whereQuery = {
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
			};
			const totalCoalitionUsers = await prisma.intraCoalitionUser.count({ where: whereQuery });
			const coalitionUsers = await prisma.intraCoalitionUser.findMany({
				...USER_QUERY_DEFAULTS,
				where: whereQuery,
			});
			return res.json({
				data: coalitionUsers,
				meta: {
					pagination: {
						total: totalCoalitionUsers,
						pages: Math.ceil(totalCoalitionUsers / itemsPerPage),
						page: pageNum,
						per_page: itemsPerPage,
					},
				},
			});
		}
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
		return res.json({
			data: coalitionUsers,
			meta: {
				pagination: {
					total: coalitionUsers.length,
					pages: 1,
					page: 1,
					per_page: coalitionUsers.length,
				},
			},
		});
	});

	// WEBHOOKS
	// All webhooks
	app.get('/admin/apisearch/hooks', async (req, res) => {
		const itemsPerPage = 50;
		const pageNum = getPageNumber(req, NaN);
		const offset = getOffset(pageNum, itemsPerPage);
		const webhooks = await prisma.intraWebhook.findMany({
			orderBy: {
				received_at: 'desc',
			},
			take: itemsPerPage,
			skip: offset,
		});
		return res.json({
			data: webhooks,
			meta: {
				pagination: {
					total: await prisma.intraWebhook.count(),
					pages: Math.ceil(await prisma.intraWebhook.count() / itemsPerPage),
					page: pageNum,
					per_page: itemsPerPage,
				},
			},
		});
	});

	// Webhooks by delivery ID
	app.get('/admin/apisearch/hooks/id/:deliveryId', async (req, res) => {
		const deliveryId = req.params.deliveryId;
		const webhooks = await prisma.intraWebhook.findMany({
			where: {
				delivery_id: deliveryId,
			},
		});
		return res.json({
			data: webhooks,
			meta: {
				pagination: {
					total: webhooks.length,
					pages: 1,
					page: 1,
					per_page: webhooks.length,
				},
			},
		});
	});

	// Webhooks by status
	app.get('/admin/apisearch/hooks/status/:status', async (req, res) => {
		const status = req.params.status;
		const itemsPerPage = 50;
		const pageNum = getPageNumber(req, NaN);
		const offset = getOffset(pageNum, itemsPerPage);
		const webhookCount = await prisma.intraWebhook.count({
			where: {
				status: status,
			},
		});
		const webhooks = await prisma.intraWebhook.findMany({
			where: {
				status: status,
			},
			orderBy: {
				received_at: 'desc',
			},
			take: itemsPerPage,
			skip: offset,
		});
		return res.json({
			data: webhooks,
			meta: {
				pagination: {
					total: webhookCount,
					pages: Math.ceil(webhookCount / itemsPerPage),
					page: pageNum,
					per_page: itemsPerPage,
				},
			},
		});
	});

	// Webhooks by model type
	app.get('/admin/apisearch/hooks/model/:modelType', async (req, res) => {
		const modelType = req.params.modelType;
		const itemsPerPage = 50;
		const pageNum = getPageNumber(req, NaN);
		const offset = getOffset(pageNum, itemsPerPage);
		const webhookCount = await prisma.intraWebhook.count({
			where: {
				model: modelType,
			},
		});
		const webhooks = await prisma.intraWebhook.findMany({
			where: {
				model: modelType,
			},
			orderBy: {
				received_at: 'desc',
			},
		});
		return res.json({
			data: webhooks,
			meta: {
				pagination: {
					total: webhookCount,
					pages: Math.ceil(webhookCount / itemsPerPage),
					page: pageNum,
					per_page: itemsPerPage,
				},
			},
		});
	});

	// Webhooks by event type
	app.get('/admin/apisearch/hooks/event/:eventType', async (req, res) => {
		const eventType = req.params.eventType;
		const itemsPerPage = 50;
		const pageNum = getPageNumber(req, NaN);
		const offset = getOffset(pageNum, itemsPerPage);
		const webhookCount = await prisma.intraWebhook.count({
			where: {
				event: eventType,
			},
		});
		const webhooks = await prisma.intraWebhook.findMany({
			where: {
				event: eventType,
			},
			orderBy: {
				received_at: 'desc',
			},
		});
		return res.json({
			data: webhooks,
			meta: {
				pagination: {
					total: webhookCount,
					pages: Math.ceil(webhookCount / itemsPerPage),
					page: pageNum,
					per_page: itemsPerPage,
				},
			},
		});
	});

	// Webhooks by (part of) the body
	app.get('/admin/apisearch/hooks/body/:body', async (req, res) => {
		const body = req.params.body;
		const itemsPerPage = 50;
		const pageNum = getPageNumber(req, NaN);
		const offset = getOffset(pageNum, itemsPerPage);
		const webhookCount = await prisma.intraWebhook.count({
			where: {
				body: {
					contains: body,
				},
			},
		});
		const webhooks = await prisma.intraWebhook.findMany({
			where: {
				body: {
					contains: body,
				},
			},
			orderBy: {
				received_at: 'desc',
			},
		});
		return res.json({
			data: webhooks,
			meta: {
				pagination: {
					total: webhookCount,
					pages: Math.ceil(webhookCount / itemsPerPage),
					page: pageNum,
					per_page: itemsPerPage,
				},
			},
		});
	});

	// EVENTS
	// 100 most recent events
	// Store them in a node-cache to speed up loading
	app.get('/admin/apisearch/events', async (req, res) => {
		try {
			const itemsPerPage = 50;
			const pageNum = getPageNumber(req, NaN);
			if (apiSearcherCache.has(`recent_events_p${pageNum}`)) {
				const cachedEvents = apiSearcherCache.get(`recent_events_p${pageNum}`) as { data: any, headers: any };
				return res.json({
					data: cachedEvents.data,
					meta: {
						pagination: getPaginationMeta(cachedEvents.headers),
					},
				});
			}

			const api = await getAPIClient();
			const recentEvents = await fetchSingleApiPage(api, `/campus/${CAMPUS_ID}/events`, {
				...API_DEFAULT_FILTERS_EVENTS,
				'page[size]': itemsPerPage.toString(),
				'filter[future]': 'false',
			});
			apiSearcherCache.set(`recent_events_p${pageNum}`, recentEvents, 60 * 60 * 3); // cache for 3 hours
			return res.json({
				data: recentEvents.data,
				meta: {
					pagination: getPaginationMeta(recentEvents.headers),
				},
			});
		}
		catch (err) {
			console.log(err);
			return res.status(500).json({ error: err });
		}
	});
};
