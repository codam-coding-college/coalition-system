import { PrismaClient, IntraUser } from "@prisma/client";
import { ExpressIntraUser } from "./intra/oauth";
const prisma = new PrismaClient();

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

export const getCoalitionIds = async function(): Promise<any> {
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
