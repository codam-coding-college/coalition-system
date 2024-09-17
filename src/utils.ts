import { PrismaClient, IntraUser } from "@prisma/client";
import { ExpressIntraUser } from "./intra/oauth";
const prisma = new PrismaClient();

export const isStudentOrStaff = async function(intraUser: ExpressIntraUser | IntraUser): Promise<boolean> {
	// If the user account is of kind "admin", let them continue
	if (intraUser.kind === 'admin') {
		return true;
	}
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
	return true;
};
