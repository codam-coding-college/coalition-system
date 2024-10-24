import { PrismaClient, IntraUser } from "@prisma/client";
import { ExpressIntraUser } from "./sync/oauth";
import Fast42 from "@codam/fast42";
import { api } from "./main";
import { INTRA_API_UID, INTRA_API_SECRET, CURSUS_ID } from "./env";

export const getAPIClient = async function(): Promise<Fast42> {
	if (!api) {
		throw new Error('API not initialized');
	}
	return api;
};

export const fetchSingleApiPage = async function(api: Fast42, endpoint: string, params: Record<string, string>): Promise<any> {
	const job = await api.getPage(endpoint, "1", params);
	try {
		if (job.status !== 200) {
			console.error(`Failed to fetch page ${endpoint} with status ${job.status}`);
			return null;
		}
		return await job.json();
	}
	catch (err) {
		console.error(`Failed to fetch page ${endpoint}`, err);
		return null;
	}
};

export const isStudentOrStaff = async function(prisma: PrismaClient, intraUser: ExpressIntraUser | IntraUser): Promise<boolean> {
	if (await isStaff(intraUser)) {
		return true;
	}
	if (await isStudent(prisma, intraUser)) {
		return true;
	}
	return false;
};

export const isStudent = async function(prisma: PrismaClient, intraUser: ExpressIntraUser | IntraUser): Promise<boolean> {
	const userId = intraUser.id;
	// If the cursus_user does not exist, the student is not enrolled in the cursus the coalition system runs on.
	// Or the student is not a part of the campus the coalition system is part of.
	const cursusUser = await prisma.intraCursusUser.findFirst({
		where: {
			user_id: userId,
			cursus_id: CURSUS_ID,
			end_at: null,
		},
	});
	return (cursusUser !== null);
};

export const isStaff = async function(intraUser: ExpressIntraUser | IntraUser): Promise<boolean> {
	return intraUser.kind === 'admin';
};

export const getCoalitionIds = async function(prisma: PrismaClient): Promise<any> {
	const coalitionIds = await prisma.intraCoalition.findMany({
		select: {
			id: true,
			slug: true,
		},
	});
	// return { slug: id, slug: id, ...}
	const returnable: { [key: string]: number } = {};
	for (const coalition of coalitionIds) {
		returnable[coalition.slug] = coalition.id;
	}
	return returnable;
};

export const parseTeamInAPISearcher = async function(prisma: PrismaClient, teams: any): Promise<any> {
	const projects = await prisma.intraProject.findMany({
		select: {
			id: true,
			slug: true,
			name: true,
			difficulty: true,
		},
	});

	// Remove all teams that are not validated
	// @ts-ignore
	teams = teams.filter(t => t['validated?'] === true);

	for (const team of teams) {
		// Add the project to the team
		// @ts-ignore
		const project = projects.find(p => p.id === team.project_id);
		team.project = project;

		// Concatenate all logins for easier displaying in a table
		// @ts-ignore
		team.logins = team.users.map(u => u.login).join(', ') || '';
	}

	// Remove all teams that do not have a corresponding project
	// @ts-ignore
	teams = teams.filter(t => t.project !== undefined);

	return teams;
};

export const parseScaleTeamInAPISearcher = async function(prisma: PrismaClient, scaleTeams: any): Promise<any> {
	const projects = await prisma.intraProject.findMany({
		select: {
			id: true,
			slug: true,
			name: true,
			difficulty: true,
		},
	});

	// Remove all evaluations done by "supervisor" (Internship evaluations)
	// @ts-ignore
	scaleTeams = scaleTeams.filter(t => t['corrector']['login'] !== "supervisor");

	for (const scaleTeam of scaleTeams) {
		// Add the project to the team
		// @ts-ignore
		const project = projects.find(p => p.id === scaleTeam.team.project_id);
		scaleTeam.team.project = project;

		// Concatenate all logins for easier displaying in a table
		// @ts-ignore
		scaleTeam.correcteds_logins = scaleTeam.correcteds.map(u => u.login).join(', ') || '';
	}

	return scaleTeams;
};
