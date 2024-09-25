import { PrismaClient, IntraUser } from "@prisma/client";
import { ExpressIntraUser } from "./sync/oauth";
import Fast42 from "@codam/fast42";
import { INTRA_API_UID, INTRA_API_SECRET } from "./env";

export const getAPIClient = async function(): Promise<Fast42> {
	return new Fast42([{
		client_id: INTRA_API_UID,
		client_secret: INTRA_API_SECRET,
	}]).init();
};

export const fetchSingleApiPage = async function(api: Fast42, endpoint: string, params: Record<string, string>): Promise<any> {
	const job = await api.get(endpoint, params);
	return await job.json();
};

export const isStudentOrStaff = async function(intraUser: ExpressIntraUser | IntraUser): Promise<boolean> {
	if (await isStaff(intraUser)) {
		return true;
	}
	if (await isStudent(intraUser)) {
		return true;
	}
	return false;
};

export const isStudent = async function(intraUser: ExpressIntraUser | IntraUser): Promise<boolean> {
	return true;
	// TODO: if the student has an ongoing 42cursus, let them continue
	const userId = intraUser.id;
	// const cursusUser = await prisma.cursusUser.findFirst({
	// 	where: {
	// 		user_id: userId,
	// 		cursus_id: 21,
	// 		end_at: null,
	// 	},
	// });
	// return (cursusUser !== null);
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
