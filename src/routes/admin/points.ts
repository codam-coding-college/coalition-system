import { Express } from 'express';
import { CodamCoalitionScore, PrismaClient } from '@prisma/client';
import fs from 'fs';
import { fetchSingleApiPage, getAPIClient, getBlocAtDate, getOffset, getPageNav, getPageNumber } from '../../utils';
import { ExpressIntraUser } from '../../sync/oauth';
import { createScore, handleFixedPointScore, shiftScore } from '../../handlers/points';
import { deleteIntraScore, syncIntraScore, syncTotalCoalitionScore, syncTotalCoalitionsScores } from '../../handlers/intrascores';

const SCORES_PER_PAGE = 100;

export const setupAdminPointsRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/points/history', async (req, res) => {
		// Calculate the total amount of pages
		const totalScores = await prisma.codamCoalitionScore.count();
		const totalPages = Math.ceil(totalScores / SCORES_PER_PAGE);
		const pageNum = getPageNumber(req, totalPages);
		const offset = getOffset(pageNum, SCORES_PER_PAGE);

		// Retrieve the scores to be displayed on the page
		const scores = await prisma.codamCoalitionScore.findMany({
			select: {
				id: true,
				intra_score_id: true,
				amount: true,
				reason: true,
				created_at: true,
				fixed_type_id: true,
				type_intra_id: true,
				coalition_id: true,
				coalition: false,
				fixed_type: false,
				user: {
					select: {
						intra_user: {
							select: {
								login: true,
							}
						}
					},
				},
			},
			orderBy: {
				created_at: 'desc',
			},
			take: SCORES_PER_PAGE,
			skip: offset,
		});

		// Retrieve all coalitions
		const coalitionRows = await prisma.codamCoalition.findMany({
			select: {
				intra_coalition: true,
			},
		});

		// Create a map of coalition id to coalition object
		const coalitions: { [key: number]: any } = {};
		for (const row of coalitionRows) {
			coalitions[row.intra_coalition.id] = row;
		}

		// Create a list of pages for the pagination nav
		const pageNav = getPageNav(pageNum, totalPages);

		return res.render('admin/points/history.njk', {
			scores,
			coalitions,
			pageNum,
			totalPages,
			pageNav,
		});
	});

	app.get('/admin/points/history/user/:login', async (req, res) => {
		const login = req.params.login;
		if (!login) {
			return res.status(400).json({ error: 'Invalid login' });
		}

		// Retrieve user
		const user = await prisma.intraUser.findFirst({
			where: {
				login: login,
			},
			select: {
				id: true,
				login: true,
			},
		});
		if (!user) {
			return res.status(404).json({ error: 'User not found' });
		}

		// Calculate the total amount of pages
		const totalScores = await prisma.codamCoalitionScore.count({
			where: {
				user_id: user.id,
			},
		});
		const totalPages = Math.ceil(totalScores / SCORES_PER_PAGE);
		const pageNum = getPageNumber(req, totalPages);
		const offset = getOffset(pageNum, SCORES_PER_PAGE);

		// Retrieve the scores to be displayed on the page
		const scores = await prisma.codamCoalitionScore.findMany({
			where: {
				user_id: user.id,
			},
			select: {
				id: true,
				intra_score_id: true,
				amount: true,
				reason: true,
				created_at: true,
				fixed_type_id: true,
				type_intra_id: true,
				coalition_id: true,
				coalition: false,
				fixed_type: false,
			},
			orderBy: {
				created_at: 'desc',
			},
			take: SCORES_PER_PAGE,
			skip: offset,
		});

		// Retrieve all coalitions
		const coalitionRows = await prisma.codamCoalition.findMany({
			select: {
				intra_coalition: true,
			},
		});

		// Create a map of coalition id to coalition object
		const coalitions: { [key: number]: any } = {};
		for (const row of coalitionRows) {
			coalitions[row.intra_coalition.id] = row;
		}

		// Create a list of pages for the pagination nav
		const pageNav = getPageNav(pageNum, totalPages);

		return res.render('admin/points/history.njk', {
			scores,
			coalitions,
			pageNum,
			totalPages,
			pageNav,
		});
	});

	app.get('/admin/points/history/:id', async (req, res) => {
		const scoreId = parseInt(req.params.id);
		if (isNaN(scoreId)) {
			return res.status(400).json({ error: 'Invalid score ID' });
		}

		const score = await prisma.codamCoalitionScore.findFirst({
			where: {
				id: scoreId,
			},
			include: {
				coalition: {
					include: {
						intra_coalition: true,
					},
				},
				user: {
					include: {
						intra_user: true,
					},
				},
				fixed_type: true,
			},
		});

		if (!score) {
			return res.status(404).json({ error: 'Score not found' });
		}

		return res.json(score);
	});

	app.get('/admin/points/history/:id/sync', async (req, res) => {
		try {
			const scoreId = parseInt(req.params.id);
			if (isNaN(scoreId)) {
				return res.status(400).json({ error: 'Invalid score ID' });
			}

			// Get the score from the database
			const score = await prisma.codamCoalitionScore.findFirst({
				where: {
					id: scoreId,
				},
			});

			if (!score) {
				return res.status(404).json({ error: 'Score not found' });
			}

			const api = await getAPIClient();
			await syncIntraScore(prisma, api, score, true);
			return res.status(200).json({ status: 'ok' });
		}
		catch (err) {
			console.error(err);
			return res.status(500).json({ error: 'An error occurred' });
		}
	});

	app.get('/admin/points/history/:id/recalculate', async (req, res) => {
		// Just trigger the right webhook again
		const scoreId = parseInt(req.params.id);
		if (isNaN(scoreId)) {
			return res.status(400).json({ error: 'Invalid score ID' });
		}

		// Get the score from the database
		const score = await prisma.codamCoalitionScore.findFirst({
			where: {
				id: scoreId,
			},
		});

		if (!score) {
			return res.status(404).json({ error: 'Score not found' });
		}

		if (score.fixed_type_id === null || score.type_intra_id === null) {
			return res.status(400).json({ error: 'Score is not based on a fixed type, cannot recalculate' });
		}

		// Retrigger the webhook using a redirect (a new trigger will update the existing score)
		return res.redirect(`/admin/points/trigger/${score.fixed_type_id}/id/${score.type_intra_id}`);
	});

	app.get('/admin/points/history/:id/delete', async (req, res) => {
		const scoreId = parseInt(req.params.id);
		if (isNaN(scoreId)) {
			return res.status(400).json({ error: 'Invalid score ID' });
		}

		// Fetch the score from the database
		const score = await prisma.codamCoalitionScore.findFirst({
			where: {
				id: scoreId,
			},
			include: {
				coalition: {
					select: {
						intra_coalition: true,
					},
				},
			},
		});

		if (!score) {
			return res.status(404).json({ error: 'Score not found' });
		}

		const api = await getAPIClient();
		await deleteIntraScore(prisma, api, score);
		await syncTotalCoalitionScore(prisma, api, score.coalition.intra_coalition);

		// Delete the score from the database
		await prisma.codamCoalitionScore.delete({
			where: {
				id: scoreId,
			},
		});

		return res.status(200).json({ status: 'ok' });
	});

	app.get('/admin/points/manual', async (req, res) => {
		// Retrieve all fixed point types
		const fixedPointTypes = await prisma.codamCoalitionFixedType.findMany({
			select: {
				type: true, // type is the name of the point type and is unique
			},
			orderBy: {
				type: 'asc',
			},
		});

		return res.render('admin/points/manual.njk', {
			fixedPointTypes,
		});
	});

	app.get('/admin/points/manual/:type', async (req, res) => {
		const type = req.params.type;
		if (type == "custom") {
			const recentCustomScores = await prisma.codamCoalitionScore.findMany({
				where: {
					fixed_type_id: null,
				},
				include: {
					user: {
						include: {
							intra_user: true,
						},
					},
					coalition: {
						include: {
							intra_coalition: true,
						},
					},
				},
				orderBy: {
					created_at: 'desc',
				},
			});

			return res.render('admin/points/manual/custom.njk', {
				manual_type: type,
				fixedPointType: null,
				recentCustomScores,
			});
		}

		const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
			where: {
				type: type,
			},
		});

		if (!fixedPointType) {
			return res.status(404).send('Point type not found');
		}

		if (type.indexOf('/') > -1 || type.indexOf('\\') > -1 || type.indexOf('..') > -1 || type.indexOf(' ') > -1) {
			// some extra sense of security
			return res.status(400).send('Invalid point type');
		}

		if (type.startsWith('event_')) {
			// Fetch 25 most recent scores assigned for organizing events
			const eventFixedPointTypes = await prisma.codamCoalitionFixedType.findMany({
				where: {
					type: {
						startsWith: 'event_',
					},
				},
				select: {
					type: true,
				},
			});
			const recentEventScores = await prisma.codamCoalitionScore.findMany({
				where: {
					fixed_type_id: {
						in: eventFixedPointTypes.map((type) => type.type),
					},
				},
				include: {
					user: {
						include: {
							intra_user: true,
						},
					},
					coalition: {
						include: {
							intra_coalition: true,
						},
					},
				},
				orderBy: {
					created_at: 'desc',
				},
			});

			return res.render('admin/points/manual/event.njk', {
				manual_type: type,
				fixedPointType,
				recentEventScores,
			});
		}

		if (fs.existsSync(`templates/admin/points/manual/${type}.njk`)) {
			return res.render(`admin/points/manual/${type}.njk`, {
				manual_type: type,
				fixedPointType,
			});
		}
		else {
			return res.status(501).send('Not implemented');
		}
	});

	app.get('/admin/points/automatic', async (req, res) => {
		// Retrieve all fixed point types
		const fixedPointTypes = await prisma.codamCoalitionFixedType.findMany({
			select: {
				type: true, // type is the name of the point type and is unique
				description: true,
				point_amount: true,
			},
			orderBy: {
				type: 'asc',
			},
		});

		// Gather total scores for each type
		const totalScores = await prisma.codamCoalitionScore.groupBy({
			by: ['fixed_type_id'],
			_sum: {
				amount: true,
			},
			where: {
				fixed_type_id: {
					not: null
				},
			},
		})

		const now = new Date();
		const currentBloc = await getBlocAtDate(prisma, now);
		const seasonScoresMap: { [key: string]: number } = {};
		if (currentBloc) {
			const scoresThisSeason = await prisma.codamCoalitionScore.groupBy({
				by: ['fixed_type_id'],
				_sum: {
					amount: true,
				},
				where: {
					created_at: {
						lte: now,
						gte: currentBloc.begin_at,
					},
					fixed_type_id: {
						not: null,
					},
				},
			});
			for (const score of scoresThisSeason) {
				seasonScoresMap[score.fixed_type_id!] = score._sum.amount!;
			}
		}

		// Map the total scores to the fixed point types
		const totalScoresMap: { [key: string]: number } = {};
		for (const score of totalScores) {
			totalScoresMap[score.fixed_type_id!] = score._sum.amount!;
		}

		return res.render('admin/points/automatic.njk', {
			fixedPointTypes,
			seasonScoresMap,
			totalScoresMap,
		});
	});

	app.get('/admin/points/automatic/:type/edit', async (req, res) => {
		const type = req.params.type;
		const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
			where: {
				type: type,
			},
		});

		if (fixedPointType === null) {
			return res.status(404).send('Point type not found');
		}

		const data: any = {
			fixedPointType,
		};
		if (fixedPointType.type === "project") {
			data['projects'] = await prisma.intraProject.findMany({
				where: {
					difficulty: {
						not: null,
						gt: 0,
					},
					exam: {
						not: true,
					},
				},
				select: {
					id: true,
					slug: true,
					name: true,
					difficulty: true,
				},
				orderBy: {
					difficulty: 'asc',
				},
			});
		}

		return res.render('admin/points/automatic_edit.njk', data);
	});

	app.post('/admin/points/automatic/:type/edit', async (req, res) => {
		const type = req.params.type;
		const pointAmount = parseInt(req.body.point_amount);

		if (isNaN(pointAmount)) { // 0 is allowed, means disabled
			return res.status(400).send('Invalid point amount');
		}

		const fixedPointType = await prisma.codamCoalitionFixedType.update({
			where: {
				type: type,
			},
			data: {
				point_amount: pointAmount,
			},
		});

		// TODO: add system to update all users' points based on this type
		// in the current tournament (optional choice in the form, not by default enabled)

		return res.redirect('/admin/points/automatic');
	});

	// Custom point types
	app.post('/admin/points/manual/event/assign', async (req, res) => {
		try {
			const eventName = req.body.event_name;
			const eventType = req.body.event_type;
			const logins = req.body.logins;
			if (!eventName || !eventType || !logins) {
				return res.status(400).send('Invalid input');
			}

			const sessionUser = req.user as ExpressIntraUser;
			console.log(`User ${sessionUser.login} is assigning points manually for ${eventType} "${eventName}" to the following logins: ${logins.replaceAll('\r', '').split('\n').join(', ')}`);

			// Get the fixed type ID for the event type
			const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
				where: {
					type: eventType,
				},
			});
			if (!fixedPointType || fixedPointType.point_amount === 0) {
				console.warn(`No fixed point type found for ${fixedPointType} or point amount is set to 0, unable to assign points`);
				return res.status(400).send(`No fixed point type found for ${fixedPointType} or point amount is set to 0, unable to assign points`);
			}

			let eventId = 0;
			if (eventName.indexOf(' | ') > 0) {
				// Assume this body is coming from the Admin Interface's event point assigning form, where the last part of the event_name is the event ID
				console.log('Splitting the event name by " | " to get the event ID (should be the last part)');
				eventId = parseInt(eventName.split(' | ').pop());
			}
			else {
				// Assume the event name is actually the event id
				console.log('Assuming the event name is the event ID');
				eventId = parseInt(eventName);
			}
			if (isNaN(eventId) || eventId <= 0) {
				console.log(`Invalid event ID: ${eventId}`);
				return res.status(400).send('Invalid event ID');
			}

			// Verify the event exists on Intra
			const api = await getAPIClient();
			const apires = await fetchSingleApiPage(api, `/events/${eventId}`);
			const intraEvent = apires.data;
			if (!intraEvent) {
				return res.status(404).send('Intra event not found');
			}

			// Init an array to store failed score creations to display to the user later
			const failedScores: { login: string, amount: number, error: string }[] = [];

			// Verify the logins exist in our database, removing duplicate logins using a Set
			const loginsArray: string[] = Array.from(new Set(logins.split('\n').map((login: string) => login.trim())));
			const users = await prisma.intraUser.findMany({
				where: {
					login: {
						in: loginsArray,
					},
				},
				select: {
					id: true,
					login: true,
				},
			});
			if (users.length !== loginsArray.length) {
				const missingLogins = loginsArray.filter((login: string) => !users.find((user: any) => user.login === login));
				console.log(`The following logins have not been found in the coalition system: ${missingLogins.join(', ')}`);
				for (const missingLogin of missingLogins) {
					failedScores.push({ login: missingLogin, amount: fixedPointType.point_amount, error: 'Login not found in coalition system' });
				}
			}

			// Assign the points
			const scores: CodamCoalitionScore[] = [];
			for (const user of users) {
				const eventDate = new Date(intraEvent.begin_at);
				const score = await handleFixedPointScore(prisma, fixedPointType, intraEvent.id, user.id, fixedPointType.point_amount,
					`(Helped) organize event "${intraEvent.name}" (${eventDate.toLocaleDateString()})`);
				// Warning: do not try to use eventDate as the score assignation date! If the event was organized in a past season, this past season could be influenced.
				if (!score) {
					console.warn(`Failed to create score for user ${user.login} for event ${intraEvent.id}`);
					failedScores.push({ login: user.login, amount: 0, error: 'Failed to create score' });
					continue;
				}
				scores.push(score);
			}

			// Display the points assigned
			return res.render('admin/points/manual/added.njk', {
				redirect: `/admin/points/manual/${eventType}`,
				scores,
				failedScores,
			});
		}
		catch (err) {
			console.error(err);
			return res.status(500).send('An error occurred');
		}
	});

	app.post('/admin/points/manual/custom/assign', async (req, res) => {
		try {
			const login = req.body.login;
			const pointAmount = parseInt(req.body.point_amount);
			const reason = req.body.reason;
			if (!login || isNaN(pointAmount) || !reason) {
				return res.status(400).send('Invalid input');
			}
			const redirect = `/admin/points/manual/custom#single-score-form`;

			const sessionUser = req.user as ExpressIntraUser;
			console.log(`User ${sessionUser.login} is assigning ${pointAmount} custom points manually to ${login} for reason "${reason}"`);

			// Verify the login exists in our database
			const user = await prisma.intraUser.findFirst({
				where: {
					login: login,
				},
				select: {
					id: true,
					login: true,
				},
			});
			if (!user) {
				console.log(`The login ${login} has not been found in the coalition system`);
				return res.render('admin/points/manual/added.njk', {
					redirect,
					scores: [],
					failedScores: [{ login, amount: pointAmount, error: 'Login not found in coalition system' }],
				});
			}

			// Assign the points
			const api = await getAPIClient();
			const score = await createScore(prisma, null, null, user.id, pointAmount, reason);
			if (!score) {
				console.warn(`Failed to create score for user ${user.login}`);
				return res.render('admin/points/manual/added.njk', {
					redirect,
					scores: [],
					failedScores: [{ login, amount: pointAmount, error: 'Failed to create score' }],
				});
			}

			// Display the points assigned
			return res.render('admin/points/manual/added.njk', {
				redirect,
				scores: [score],
				failedScores: [],
			});
		}
		catch (err) {
			console.error(err);
			return res.status(500).send('An error occurred');
		}
	});

	app.post('/admin/points/manual/custom-csv/assign', async (req, res) => {
		try {
			const csv = req.body.csv;
			if (!csv) {
				return res.status(400).send('Invalid input');
			}

			const sessionUser = req.user as ExpressIntraUser;
			console.log(`User ${sessionUser.login} is assigning custom points manually using CSV`);

			// Parse csv
			const lines = csv.split('\n');
			let scoresToCreate: { login: string, points: number, reason: string }[] = [];
			let lineNumber = 0;
			for (const line of lines) {
				lineNumber++;
				if (!line.trim()) {
					// Skip empty lines
					continue;
				}
				const parts = line.split(',');
				if (parts.length !== 3) {
					console.log(`Invalid line ${lineNumber} in CSV. Columns missing. Line: ${parts}`);
					return res.status(400).send(`Invalid line ${lineNumber} in CSV. Columns missing. Expected format: login,points,reason`);
				}

				const login = parts[0].trim();
				const points = parseInt(parts[1].trim());
				const reason = parts[2].trim();
				if ((!login || isNaN(points) || !reason) && lines.length > 1 && lineNumber === 1 && lines[1].indexOf(",") > -1) {
					// Assume first line is a header, next line contains columns too
					continue;
				}
				if (!login || isNaN(points) || !reason) {
					console.log(`Invalid line ${lineNumber} in CSV. Failed to parse content. Line: ${parts}`);
					return res.status(400).send(`Invalid line ${lineNumber} in CSV. Failed to parse content. Expected format: login,points,reason`);
				}

				scoresToCreate.push({ login, points, reason });
			}
			const failedScores: { login: string, amount: number, error: string }[] = [];

			// Verify the logins exist in our database
			const loginsArray = scoresToCreate.map((score) => score.login);
			const users = await prisma.intraUser.findMany({
				where: {
					login: {
						in: loginsArray,
					},
				},
				select: {
					id: true,
					login: true,
				},
			});
			// Get the list of unique logins in loginsArray
			const uniqueUsers = Array.from(new Set(loginsArray));
			if (users.length !== uniqueUsers.length) {
				const missingLogins = uniqueUsers.filter((login: string) => !users.find((user: any) => user.login === login));
				console.log(`The following logins have not been found in the coalition system: ${missingLogins.join(', ')}`);
				for (const missingLogin of missingLogins) {
					// Add error message for each missing login
					for (const score of scoresToCreate.filter((score) => score.login === missingLogin)) {
						failedScores.push({ login: missingLogin, amount: score.points, error: 'Login not found in coalition system' });
					}
					// Remove each missing login from the scoresToCreate array
					scoresToCreate = scoresToCreate.filter((score) => score.login !== missingLogin);
				}
			}

			// Assign the points
			const scores: CodamCoalitionScore[] = [];
			for (const scoreToCreate of scoresToCreate) {
				const user = users.find((user: any) => user.login === scoreToCreate.login);
				if (!user) {
					console.warn(`User not found for login ${scoreToCreate.login}, which is weird, because earlier we did select all users with specified logins...`);
					failedScores.push({ login: scoreToCreate.login, amount: scoreToCreate.points, error: 'User not found' });
					continue;
				}
				console.log(`User ${sessionUser.login} is assigning ${scoreToCreate.points} custom points manually to ${user.login} with reason "${scoreToCreate.reason}"`);
				const score = await createScore(prisma, null, null, user.id, scoreToCreate.points, scoreToCreate.reason, new Date(), false);
				if (!score) {
					console.warn(`Failed to create score for user ${user.login}`);
					failedScores.push({ login: user.login, amount: scoreToCreate.points, error: 'Failed to create score' });
					continue;
				}
				scores.push(score);
			}

			// Display the points assigned
			return res.render('admin/points/manual/added.njk', {
				redirect: `/admin/points/manual/custom#many-score-form`,
				scores,
				failedScores,
			});
		}
		catch (err) {
			console.error(err);
			return res.status(500).send('An error occurred');
		}
	});

	app.get('/admin/points/shift', async (req, res) => {
		// Page to shift points from in-between seasons to the exact start of the next season

		const blocDeadlines = await prisma.intraBlocDeadline.findMany({
			where: {
				begin_at: {
					lt: new Date(),
				},
			},
			orderBy: {
				begin_at: 'asc',
			},
		});

		const shiftablePoints: { [key: number]: number } = {};
		for (let i = 0; i < blocDeadlines.length; i++) {
			const shiftablePointsForBloc = await prisma.codamCoalitionScore.aggregate({
				_sum: {
					amount: true,
				},
				where: {
					created_at: {
						gte: (i > 0 ? blocDeadlines[i - 1].end_at : new Date(0)),
						lt: blocDeadlines[i].begin_at,
					},
				},
			});
			shiftablePoints[blocDeadlines[i].id] = shiftablePointsForBloc._sum.amount || 0;
		}

		return res.render('admin/points/shift.njk', {
			blocDeadlines,
			shiftablePoints,
		});
	});

	app.post('/admin/points/shift', async (req, res) => {
		const user = req.user as ExpressIntraUser;
		if (!user) {
			return res.status(401).send('Unauthorized');
		}

		const seasonId = parseInt(req.body.season);
		if (isNaN(seasonId)) {
			return res.status(400).send('Invalid season');
		}

		console.warn(`User ${user.login} is shifting points from in-between seasons to the exact start of the next season (to season blocdeadline id ${seasonId})`);

		const blocDeadline = await prisma.intraBlocDeadline.findFirst({
			where: {
				id: seasonId,
			},
		});
		if (!blocDeadline) {
			return res.status(404).send('Season not found');
		}
		const previousBlocDeadline = await prisma.intraBlocDeadline.findFirst({
			where: {
				begin_at: {
					lt: blocDeadline.begin_at,
				},
				end_at: {
					lt: blocDeadline.begin_at,
				},
			},
			orderBy: {
				begin_at: 'desc',
			},
		});

		// Shift points from in-between seasons to the exact start of the next season
		const scoresToShift = await prisma.codamCoalitionScore.findMany({
			where: {
				created_at: {
					gte: previousBlocDeadline ? previousBlocDeadline.end_at : new Date(0),
					lt: blocDeadline.begin_at,
				},
			},
			select: {
				id: true,
			},
		});
		// This might take a long time
		// TODO: maybe update all in one go? Might make it more difficult to update Intra scores though...
		// Do we even push scores to Intra that fall outside of a season?
		for (const score of scoresToShift) {
			await shiftScore(prisma, score.id, blocDeadline.begin_at);
		}

		console.log(`User ${user.login} has shifted ${scoresToShift.length} scores to the start of season ${seasonId} - ${blocDeadline.begin_at.toLocaleString()}`);

		// Done, redirect back to the form
		return res.redirect('/admin/points/shift');
	});
};
