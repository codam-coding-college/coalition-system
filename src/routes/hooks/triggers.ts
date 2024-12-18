// Webhook triggers for the admin panel
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { getAPIClient, fetchSingleApiPage } from '../../utils';
import { handleLocationCloseWebhook, Location } from './locations';
import { handleProjectsUserUpdateWebhook, ProjectUser } from './projects_users';
import { handleScaleTeamUpdateWebhook, ScaleTeam } from './scale_teams';

export const setupWebhookTriggerRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/points/trigger/logtime/id/:id', async (req, res) => {
		// ID belongs to a location ID in the intra system
		const api = await getAPIClient();
		try {
			const apires = await fetchSingleApiPage(api, `/locations/${req.params.id}`, {});
			const location: Location = apires.data as Location;
			if (location === null) {
				console.error(`Failed to find location ${req.params.id}, cannot trigger location close webhook`);
				return res.status(404).json({ error: 'Location not found' });
			}
			await handleLocationCloseWebhook(prisma, location);
			return res.status(200).json({ status: 'ok' });
		}
		catch (err) {
			console.error(`Failed to trigger location close webhook for location ${req.params.id}`, err);
			return res.status(500).json({ error: err });
		}
	});

	app.get('/admin/points/trigger/project/id/:id', async (req, res) => {
		// Assume ID is a projects_user ID
		return res.redirect(`/admin/points/trigger/project/projects_user_id/${req.params.id}`);
	});

	app.get('/admin/points/trigger/project/team_id/:id', async (req, res) => {
		// ID belongs to a team ID in the intra system
		const api = await getAPIClient();
		try {
			const apires = await fetchSingleApiPage(api, `/teams/${req.params.id}`, {});
			const team = apires.data;
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
					const apires2 = await fetchSingleApiPage(api, `/projects_users/${user.projects_user_id}`, {});
					const projectUser: ProjectUser = apires2.data as ProjectUser;
					await handleProjectsUserUpdateWebhook(prisma, projectUser);
				}
				catch (err) {
					console.error(`Failed to trigger projects_user update ${user.projects_user_id} for team ${team.id}`, err);
				}
			}
			return res.status(200).json({ status: 'ok' });
		}
		catch (err) {
			console.error(`Failed to trigger projects_user update for team ${req.params.id}`, err);
			return res.status(500).json({ error: err });
		}
	});

	app.get('/admin/points/trigger/project/projects_user_id/:id', async (req, res) => {
		// ID belongs to a projects_user ID in the intra system
		const api = await getAPIClient();
		try {
			const apires = await fetchSingleApiPage(api, `/projects_users/${req.params.id}`, {});
			const projectUser: ProjectUser = apires.data as ProjectUser;
			await handleProjectsUserUpdateWebhook(prisma, projectUser);
			return res.status(200).json({ status: 'ok' });
		}
		catch (err) {
			console.error(`Failed to trigger projects_user update webhook for projects_user ${req.params.id}`, err);
			return res.status(500).json({ error: err });
		}
	});

	app.get('/admin/points/trigger/exam/id/:id', async (req, res) => {
		// Assume ID is a projects_user ID
		return res.redirect(`/admin/points/trigger/exam/projects_user_id/${req.params.id}`);
	});

	app.get('/admin/points/trigger/exam/team_id/:id', async (req, res) => {
		// Redirect to project team ID trigger
		return res.redirect(`/admin/points/trigger/project/team_id/${req.params.id}`);
	});

	app.get('/admin/points/trigger/exam/projects_user_id/:id', async (req, res) => {
		// Redirect to project projects_user ID trigger
		return res.redirect(`/admin/points/trigger/project/projects_user_id/${req.params.id}`);
	});

	app.get('/admin/points/trigger/evaluation/id/:id', async (req, res) => {
		// ID belongs to a scale_team ID in the intra system
		const api = await getAPIClient();
		try {
			const apires = await fetchSingleApiPage(api, `/scale_teams/${req.params.id}`, {});
			const scaleTeam: ScaleTeam = apires.data as ScaleTeam;

			await handleScaleTeamUpdateWebhook(prisma, scaleTeam);
			return res.status(200).json({ status: 'ok' });
		}
		catch (err) {
			console.error(`Failed to trigger scale_team update webhook for scale_team ${req.params.id}`, err);
			return res.status(500).json({ error: err });
		}
	});
};
