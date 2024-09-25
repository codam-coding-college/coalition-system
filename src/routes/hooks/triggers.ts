// Webhook triggers for the admin panel
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import Fast42 from '@codam/fast42';
import { CAMPUS_ID, CURSUS_ID } from '../../env';
import { getAPIClient, fetchSingleApiPage } from '../../utils';
import { handleLocationCloseWebhook, Location } from './locations';
import { handleProjectsUserUpdateWebhook, ProjectUser } from './projects_users';

export const setupWebhookTriggerRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/points/trigger/logtime/id/:id', async (req, res) => {
		// ID belongs to a location ID in the intra system
		const api = await getAPIClient();
		const location: Location = await fetchSingleApiPage(api, `/locations/${req.params.id}`, {}) as Location;
		if (location === null) {
			console.error(`Failed to find location ${req.params.id}, cannot trigger location close webhook`);
			return res.status(404).json({ error: 'Location not found' });
		}
		await handleLocationCloseWebhook(prisma, location);
		return res.status(200).json({ status: 'ok' });
	});

	app.get('/admin/points/trigger/project/team_id/:id', async (req, res) => {
		// ID belongs to a team ID in the intra system
		const api = await getAPIClient();
		const team = await fetchSingleApiPage(api, `/teams/${req.params.id}`, {});
		if (team === null) {
			console.error(`Failed to find team ${req.params.id}, cannot trigger projectsUser update webhook for team users`);
			return res.status(404).json({ error: 'Team not found' });
		}
		// Go over all user's projects_users in the team
		for (const user of team.users) {
			if (!user.projects_user_id) {
				console.warn(`User ${user.id} in team ${team.id} has no projects_user ID, skipping projectsUser update webhook...`);
			}
			try {
				const projectUser: ProjectUser = await fetchSingleApiPage(api, `/projects_users/${user.projects_user_id}`, {}) as ProjectUser;
				await handleProjectsUserUpdateWebhook(prisma, projectUser);
			}
			catch (err) {
				console.error(`Failed to trigger projects_user update ${user.projects_user_id} for team ${team.id}`, err);
			}
		}
		return res.status(200).json({ status: 'ok' });
	});

	app.get('/admin/points/trigger/exam/team_id/:id', async (req, res) => {
		// Redirect to project team ID trigger
		res.redirect(`/admin/points/trigger/project/team_id/${req.params.id}`);
	});

	// Currently unused
	app.get('/admin/points/trigger/project/projects_user_id/:id', async (req, res) => {
		// ID belongs to a projects_user ID in the intra system
		const api = await getAPIClient();
		const projectUser: ProjectUser = await fetchSingleApiPage(api, `/projects_users/${req.params.id}`, {}) as ProjectUser;
		if (projectUser === null) {
			console.error(`Failed to find projects_user ${req.params.id}, cannot trigger projectsUser update webhook`);
			return res.status(404).json({ error: 'Project user not found' });
		}
		await handleProjectsUserUpdateWebhook(prisma, projectUser);
	});

	app.get('/admin/points/trigger/exam/projects_user_id/:id', async (req, res) => {
		// Redirect to project projects_user ID trigger
		res.redirect(`/admin/points/trigger/project/projects_user_id/${req.params.id}`);
	});
};
