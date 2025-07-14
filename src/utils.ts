import { PrismaClient, IntraUser, IntraCoalition, IntraBlocDeadline, CodamCoalitionScore } from "@prisma/client";
import { ExpressIntraUser } from "./sync/oauth";
import Fast42 from "@codam/fast42";
import { api } from "./main";
import { CURSUS_ID } from "./env";
import NodeCache from "node-cache";
import { Request } from "express";

export const getAPIClient = async function(): Promise<Fast42> {
	if (!api) {
		throw new Error('API not initialized');
	}
	return api;
};

export const fetchSingleApiPage = function(api: Fast42, endpoint: string, params: Record<string, string> = {}, pageNum: number = 1): Promise<{headers: any, data: any}> {
	return new Promise(async (resolve, reject) => {
		try {
			const job = await api.getPage(endpoint, pageNum.toString(), params);
			if (job.status !== 200) {
				console.error(`Failed to fetch page ${endpoint} with status ${job.status}`);
				reject(`Failed to fetch page ${endpoint} with status ${job.status}`);
			}
			const headers = job.headers.raw();
			const data = await job.json();
			resolve({ headers, data });
		}
		catch (err) {
			console.error(`Failed to fetch page ${endpoint}`, err);
			reject(err);
		}
	});
};

export const getPageNumber = function(req: Request, totalPages: number | null): number {
	const pageNum = (req.query.page ? parseInt(req.query.page as string) : 1);
	if (pageNum < 1 || isNaN(pageNum)) {
		return 1;
	}
	if (totalPages && !isNaN(totalPages) && pageNum > totalPages) {
		return totalPages;
	}
	return pageNum;
};

export const getOffset = function(pageNum: number, itemsPerPage: number): number {
	return (pageNum - 1) * itemsPerPage;
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

export interface PageNav {
	num: number;
	active: boolean;
	text: string;
};

export const getPageNav = function(currentPage: number, totalPages: number, maxPages: number = 7): PageNav[] {
	const pageNav: { num: number, active: boolean, text: string }[] = [];
	const halfMaxPages = Math.floor(maxPages / 2);
	let startPage = Math.max(1, currentPage - halfMaxPages);
	let endPage = Math.min(totalPages, startPage + maxPages - 1);
	if (endPage - startPage < maxPages - 1) {
		startPage = Math.max(1, endPage - maxPages + 1);
	}
	if (endPage - startPage < maxPages - 1) {
		endPage = Math.min(totalPages, startPage + maxPages - 1);
	}
	if (endPage - startPage < maxPages - 1) {
		startPage = Math.max(1, endPage - maxPages + 1);
	}
	if (startPage > 1) {
		pageNav.push({
			num: 1,
			active: false,
			text: 'First',
		});
		pageNav.push({
			num: currentPage - 1,
			active: false,
			text: '<',
		});
	}
	for (let i = startPage; i <= endPage; i++) {
		pageNav.push({
			num: i,
			active: i === currentPage,
			text: i.toString(),
		});
	}
	if (endPage < totalPages) {
		pageNav.push({
			num: currentPage + 1,
			active: false,
			text: '>',
		});
		pageNav.push({
			num: totalPages,
			active: false,
			text: 'Last',
		});
	}
	return pageNav;
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

export const timeAgo = function(date: Date | null): string {
	if (!date) {
		return 'never';
	}

	const now = new Date();
	const diff = now.getTime() - date.getTime();
	if (diff < 0) {
		// Date is in the future!
		return timeFromNow(date);
	}
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const years = Math.floor(days / 365);

	if (years > 2) {
		return `${years} years ago`;
	}
	else if (days > 2) { // < 3 days we want to see the hours
		return `${days} days ago`;
	}
	else if (hours > 1) {
		return `${hours} hours ago`;
	}
	else if (minutes > 1) {
		return `${minutes} minutes ago`;
	}
	return `just now`; // don't specify: otherwise it's weird when the amount of seconds does not go up
};

export const timeFromNow = function(date: Date | null): string {
	if (!date) {
		return 'never';
	}

	const now = new Date();
	const diff = date.getTime() - now.getTime();
	if (diff < 0) {
		// Date is in the past!
		return timeAgo(date);
	}
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	const years = Math.floor(days / 365);

	if (years > 2) {
		return `in ${years} years`;
	}
	else if (days > 2) { // < 3 days we want to see the hours
		return `in ${days} days`;
	}
	else if (hours > 1) {
		return `in ${hours} hours`;
	}
	else if (minutes > 1) {
		return `in ${minutes} minutes`;
	}
	return `within a minute`; // don't specify: otherwise it's weird when the amount of seconds does not go down
};

const blocCache = new NodeCache({
	stdTTL: 60 * 60, // 1 hour
	checkperiod: 60 * 5, // 5 minutes
	useClones: false,
});
export const getBlocAtDate = async function(prisma: PrismaClient, date: Date = new Date()): Promise<IntraBlocDeadline | null> {
	if (!blocCache.has('blocs')) {
		// Cache the blocs to prevent querying the database every time
		console.log('Fetching blocs from database');
		const blocs = await prisma.intraBlocDeadline.findMany({
			orderBy: {
				begin_at: 'asc',
			},
		});
		blocCache.set('blocs', blocs);
	}

	const blocs = blocCache.get('blocs') as IntraBlocDeadline[];
	for (const bloc of blocs) {
		if (bloc.begin_at <= date && bloc.end_at > date) {
			return bloc;
		}
	}
	return null;
};

export const scoreBelongsToBloc = function(score: CodamCoalitionScore, bloc: IntraBlocDeadline): boolean {
	return score.created_at >= bloc.begin_at && score.created_at < bloc.end_at;
};

export const getUserTournamentRanking = async function(prisma: PrismaClient, userId: number, date: Date = new Date()): Promise<number> {
	const userCoalition = await prisma.intraCoalitionUser.findFirst({
		where: {
			user_id: userId,
		},
	});
	const bloc = await getBlocAtDate(prisma, date);
	if (!userCoalition || !bloc) {
		return 0; // No coalition for user or no season currently ongoing
	}

	const scores = await prisma.codamCoalitionScore.groupBy({
		by: ['user_id'],
		_sum: {
			amount: true,
		},
		where: {
			created_at: {
				lte: date,
				gte: bloc.begin_at,
			},
			coalition_id: userCoalition.coalition_id, // Only get scores for the user's coalition to get the position within the coalition
		},
		orderBy: {
			_sum: {
				amount: 'desc',
			},
		}
	});
	const userRanking = scores.findIndex(s => s.user_id === userId);
	return userRanking + 1;
};

export interface NormalDistribution {
	dataPoints: number[];
	mean: number;
	median: number;
	stdDev: number;
	min: number;
	max: number;
};

export const getScoresPerType = async function(prisma: PrismaClient, coalitionId: number, untilDate: Date = new Date()): Promise<{ [key: string]: number }> {
	const bloc = await getBlocAtDate(prisma, untilDate);
	if (!bloc) {
		return {}; // No season currently ongoing
	}
	const fixedTypes = await prisma.codamCoalitionFixedType.findMany({
		orderBy: {
			type: 'asc',
		},
	});
	const scores = await prisma.codamCoalitionScore.groupBy({
		by: ['fixed_type_id'],
		where: {
			coalition_id: coalitionId,
			created_at: {
				lte: untilDate,
				gte: bloc.begin_at,
			},
		},
		_sum: {
			amount: true,
		},
	});
	const scoresPerType: { [key: string]: number } = {};
	for (const fixedType of fixedTypes) {
		const score = scores.find(s => s.fixed_type_id === fixedType.type);
		scoresPerType[fixedType.type] = score && score._sum.amount ? score._sum.amount : 0;
	}
	// Fallback for fixed_type_id null
	const score = scores.find(s => s.fixed_type_id === null);
	scoresPerType['unknown'] = score && score._sum.amount ? score._sum.amount : 0;
	return scoresPerType;
}

const getEmptyNormalDistribution = function(): NormalDistribution {
	return {
		dataPoints: [],
		mean: 0,
		median: 0,
		stdDev: 0,
		min: 0,
		max: 0,
	};
};

export const getScoresNormalDistribution = async function(prisma: PrismaClient, coalitionId: number, untilDate: Date = new Date()): Promise<NormalDistribution> {
	const bloc = await getBlocAtDate(prisma, untilDate);
	if (!bloc) { // No season currently ongoing
		return getEmptyNormalDistribution();
	}
	const scores = await prisma.codamCoalitionScore.groupBy({
		by: ['user_id'],
		where: {
			coalition_id: coalitionId,
			created_at: {
				lte: untilDate,
				gte: bloc.begin_at,
			},
		},
		_sum: {
			amount: true,
		},
		orderBy: {
			_sum: {
				amount: 'asc',
			},
		},
	});
	if (scores.length === 0) { // No scores for this coalition
		return getEmptyNormalDistribution();
	}
	// console.log(scores);
	const scoresArray = scores.map(s => s._sum.amount ? s._sum.amount : 0);
	const scoresSum = scoresArray.reduce((a, b) => a + b, 0);
	const scoresMean = scoresSum / scoresArray.length;
	const scoresMedian = scoresArray[Math.floor(scoresArray.length / 2)];
	const scoresVariance = scoresArray.reduce((a, b) => a + Math.pow(b - scoresMean, 2), 0) / scoresArray.length;
	const scoresStdDev = Math.sqrt(scoresVariance);
	const scoresMin = Math.min(...scoresArray);
	const scoresMax = Math.max(...scoresArray);
	return {
		dataPoints: scoresArray,
		mean: scoresMean,
		median: scoresMedian,
		stdDev: scoresStdDev,
		min: scoresMin,
		max: scoresMax,
	};
};

export interface CoalitionScore {
	coalition_id: number;
	score: number;
	totalPoints: number;
	avgPoints: number;
	medianPoints: number;
	stdDevPoints: number;
	minActivePoints: number; // Minimum score for a user to be considered active
	totalContributors: number;
	activeContributors: number;
}

export const getCoalitionScore = async function(prisma: PrismaClient, coalitionId: number, atDateTime: Date = new Date()): Promise<CoalitionScore> {
	const normalDist = await getScoresNormalDistribution(prisma, coalitionId, atDateTime);
	const minScore = Math.floor(normalDist.mean - normalDist.stdDev);
	const activeScores = normalDist.dataPoints.filter(s => s >= minScore);
	const fairScore = Math.floor(activeScores.reduce((a, b) => a + b, 0) / activeScores.length);
	return {
		coalition_id: coalitionId,
		totalPoints: normalDist.dataPoints.reduce((a, b) => a + b, 0),
		avgPoints: normalDist.mean,
		medianPoints: normalDist.median,
		stdDevPoints: normalDist.stdDev,
		minActivePoints: minScore,
		score: Math.floor(normalDist.mean), // fairScore can jump down too easily when there are a couple of really well scoring students on top of the leaderboard (scores dataset is not a normal distribution)
		totalContributors: normalDist.dataPoints.length,
		activeContributors: activeScores.length,
	};
};

export interface SingleRanking {
	rankingName: string;
	user: IntraUser;
	coalition: IntraCoalition | null;
	score: number;
	rank: number;
}

export const scoreSumsToRanking = async function(prisma: PrismaClient, scores: { user_id: number, _sum: { amount: number | null } }[], rankingName: string): Promise<SingleRanking[]> {
	const ranking: SingleRanking[] = [];
	let rank = 1;
	for (const score of scores) {
		const user = await prisma.intraUser.findFirst({
			where: {
				id: score.user_id,
			},
		});
		if (!user || !score._sum.amount) {
			continue;
		}
		ranking.push({
			user,
			rankingName: rankingName,
			score: score._sum.amount,
			coalition: null,
			rank: rank++,
		});
	}
	return ranking;
};

export const getRanking = async function(prisma: PrismaClient, rankingType: string, atDateTime: Date = new Date(), topAmount: number = 10): Promise<SingleRanking[]> {
	const ranking = await prisma.codamCoalitionRanking.findFirst({
		where: {
			type: rankingType,
		},
		include: {
			fixed_types: true,
		},
	});
	if (!ranking) {
		throw new Error(`Ranking type ${rankingType} not found`);
	}

	// TODO: take into account the TOURNAMENT (not SEASONS!)
	const scores = await prisma.codamCoalitionScore.groupBy({
		by: ['user_id'],
		where: {
			created_at: {
				lte: atDateTime,
			},
			fixed_type_id: {
				in: ranking.fixed_types.map(t => t.type),
			},
		},
		_sum: {
			amount: true,
		},
		orderBy: {
			_sum: {
				amount: 'desc',
			},
		},
		take: (topAmount === Infinity ? undefined : topAmount),
	});

	const rankings: SingleRanking[] = [];
	let currentRank = 0;
	let lastScore = Infinity;
	for (const score of scores) {
		if (score._sum.amount === null || score._sum.amount <= 0) {
			continue;
		}
		const user = await prisma.intraUser.findFirst({
			where: {
				id: score.user_id,
			},
			include: {
				coalition_users: {
					include: {
						coalition: true,
					}
				}
			}
		});
		if (!user) {
			continue;
		}
		if (lastScore > score._sum.amount) { // Only increase rank if the score is lower than the previous one, otherwise it's a tie
			currentRank = rankings.length + 1;
			lastScore = score._sum.amount;
		}
		rankings.push({
			rankingName: ranking.name,
			user: user,
			score: score._sum.amount ? score._sum.amount : 0,
			rank: currentRank,
			coalition: (user.coalition_users.length > 0 ? user.coalition_users[0].coalition : null),
		});
	}

	return rankings;
};

export const getUserRanking = async function(prisma: PrismaClient, rankingType: string, userId: number, atDateTime: Date = new Date()): Promise<SingleRanking | null> {
	const ranking = await getRanking(prisma, rankingType, atDateTime, 100); // Don't care if the user is not in the top 100
	const userRanking = ranking.find(r => r.user.id === userId);
	return (userRanking ? userRanking : null);
}

export const getUserRankingAcrossAllRankings = async function(prisma: PrismaClient, userId: number, atDateTime: Date = new Date()): Promise<SingleRanking[]> {
	const rankings = await prisma.codamCoalitionRanking.findMany({
		select: {
			type: true,
		}
	});
	const userRankings: SingleRanking[] = [];
	for (const ranking of rankings) {
		const userRanking = await getUserRanking(prisma, ranking.type, userId, atDateTime);
		if (userRanking) {
			userRankings.push(userRanking);
		}
	}
	return userRankings.sort((a, b) => a.rank - b.rank);
};
