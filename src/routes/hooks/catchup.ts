import { PrismaClient } from "@prisma/client";
import { fetchMultiple42ApiPagesCallback, fetchSingle42ApiPage } from "../../sync/base";
import { getAPIClient } from "../../utils";
import { CAMPUS_ID } from "../../env";
import { handleLocationCloseWebhook, Location } from "./locations";
import { API_DEFAULT_FILTERS_LOCATIONS, API_DEFAULT_FILTERS_PROJECTS, API_DEFAULT_FILTERS_SCALE_TEAMS } from "../admin/apisearcher";
import { handleProjectsUserUpdateWebhook, ProjectUser } from "./projects_users";
import { handleScaleTeamUpdateWebhook, ScaleTeam } from "./scale_teams";

export interface CatchupOperation {
	ongoing: boolean;
	startDate: Date | null;
	endDate: Date | null;
	progress: number;
	filter: {
		locations: boolean;
		projects: boolean;
		evaluations: boolean;
		pool_donations: boolean;
	};
}

const getFilterCount = (filter: CatchupOperation['filter']): number => {
	return Object.values(filter).filter((value) => value).length;
}

const updatePercentage = (catchupOperation: CatchupOperation, currentStep: number, currentStepItem: number, totalStepItems: number): number => {
	const totalSteps = getFilterCount(catchupOperation.filter);
	catchupOperation.progress = Math.floor((currentStep + (currentStepItem / totalStepItems)) / totalSteps * 100);
	// If the percentage is a whole number, log it
	if (catchupOperation.progress % 1 === 0) {
		console.log(`Catch-up operation progress: step ${currentStep + 1}/${totalSteps} - ${catchupOperation.progress}%`);
	}
	return catchupOperation.progress;
}

const catchupLocations = async (catchupOperation: CatchupOperation, stepNumber: number, prisma: PrismaClient): Promise<void> => {
	return new Promise(async (allDone, catchupFail) => {
		const api = await getAPIClient();
		let itemsHandled = 0;
		let itemsTotal = 0;
		fetchMultiple42ApiPagesCallback(api, `/campus/${CAMPUS_ID}/locations`, {
				...API_DEFAULT_FILTERS_LOCATIONS,
				'sort': 'end_at', // Oldest first
				'range[end_at]': `${catchupOperation.startDate?.toISOString()},${catchupOperation.endDate?.toISOString()}`,
			},
			async (locations, xPage, xTotal) => {
				if (itemsTotal === 0) {
					itemsTotal = xTotal;
				}
				for (const location of locations) {
					try {
						const parsedLocation = location as Location;
						await handleLocationCloseWebhook(prisma, parsedLocation);
						itemsHandled++;
						updatePercentage(catchupOperation, stepNumber, itemsHandled, xTotal);
					}
					catch (err) {
						console.error(`Error catching up on location ${location.id} of ${location.user.login} on ${location.host} at ${location.begin_at}: ${err}`);
					}
				}
				console.debug(`Handled ${itemsHandled} out of ${xTotal} locations.`);
				if (itemsHandled == xTotal) {
					console.debug('All locations handled.');
					allDone();
				}
			}
		);
	});
}

const catchupProjectsAndExams = async (catchupOperation: CatchupOperation, stepNumber: number, prisma: PrismaClient): Promise<void> => {
	return new Promise(async (allDone, catchupFail) => {
		const api = await getAPIClient();
		let itemsHandled = 0;
		let itemsTotal = 0;
		fetchMultiple42ApiPagesCallback(api, `/teams`, {
				...API_DEFAULT_FILTERS_PROJECTS,
				'sort': 'updated_at', // Oldest first
				'range[updated_at]': `${catchupOperation.startDate?.toISOString()},${catchupOperation.endDate?.toISOString()}`,
			},
			async (teams, xPage, xTotal) => {
				if (itemsTotal === 0) {
					itemsTotal = xTotal;
				}
				for (const team of teams) {
					try {
						// Go over all user's projects_users in the team
						for (const user of team.users) {
							if (!user.projects_user_id) {
								console.warn(`User ${user.id} in team ${team.id} has no projects_user ID, skipping projectsUser update webhook...`);
							}
							try {
								const projectUser: ProjectUser = await fetchSingle42ApiPage(api, `/projects_users/${user.projects_user_id}`, {}) as ProjectUser;
								await handleProjectsUserUpdateWebhook(prisma, projectUser);
							}
							catch (err) {
								console.error(`Failed to trigger projects_user update ${user.projects_user_id} for team ${team.id}`, err);
							}
						}
						itemsHandled++;
						updatePercentage(catchupOperation, stepNumber, itemsHandled, xTotal);
					}
					catch (err) {
						console.error(`Error catching up on team ${team.id}: ${err}`);
					}
				}
				console.debug(`Handled ${itemsHandled} out of ${xTotal} teams.`);
				if (itemsHandled == xTotal) {
					console.debug('All teams handled.');
					allDone();
				}
			}
		);
	});
}

const catchupEvaluations = async (catchupOperation: CatchupOperation, stepNumber: number, prisma: PrismaClient): Promise<void> => {
	return new Promise(async (allDone, catchupFail) => {
		const api = await getAPIClient();
		let itemsHandled = 0;
		let itemsTotal = 0;
		fetchMultiple42ApiPagesCallback(api, `/scale_teams`, {
				...API_DEFAULT_FILTERS_SCALE_TEAMS,
				'sort': 'updated_at', // Oldest first
				'range[updated_at]': `${catchupOperation.startDate?.toISOString()},${catchupOperation.endDate?.toISOString()}`,
			},
			async (scaleTeams, xPage, xTotal) => {
				if (itemsTotal === 0) {
					itemsTotal = xTotal;
				}
				for (const scaleTeam of scaleTeams) {
					try {
						const parsedScaleTeam = scaleTeam as ScaleTeam;
						await handleScaleTeamUpdateWebhook(prisma, parsedScaleTeam);
						itemsHandled++;
						updatePercentage(catchupOperation, stepNumber, itemsHandled, xTotal);
					}
					catch (err) {
						console.error(`Error catching up on scale team ${scaleTeam.id}: ${err}`);
					}
				}
				console.debug(`Handled ${itemsHandled} out of ${xTotal} scale_teams.`);
				if (itemsHandled == xTotal) {
					console.debug('All scale_teams handled.');
					allDone();
				}
			}
		);
	});
}

export const startCatchupOperation = async (catchupOperation: CatchupOperation, prisma: PrismaClient): Promise<void> => {
	console.log(`Starting catch-up operation from ${catchupOperation.startDate} to ${catchupOperation.endDate}...`);
	let currentStep = 0;

	if (catchupOperation.filter.locations) {
		console.log('Starting locations catch-up...');
		await catchupLocations(catchupOperation, currentStep, prisma);
		console.log('Locations catch-up completed.');
		currentStep++;
	}

	if (catchupOperation.filter.projects) {
		console.log('Starting projects & exams catch-up...');
		await catchupProjectsAndExams(catchupOperation, currentStep, prisma);
		console.log('Projects & exams catch-up completed.');
		currentStep++;
	}

	if (catchupOperation.filter.evaluations) {
		console.log('Starting evaluations catch-up...');
		await catchupEvaluations(catchupOperation, currentStep, prisma);
		console.log('Evaluations catch-up completed.');
		currentStep++;
	}

	if (catchupOperation.filter.pool_donations) {
		console.log('Starting pool donations catch-up...');
		console.log('Pool donations catch-up completed.');
		currentStep++;
		// Note: cannot be done with Intra API, how do we implement this?
	}

	console.log('Catch-up operation completed.');
	catchupOperation.ongoing = false;
	catchupOperation.progress = 100;
};
