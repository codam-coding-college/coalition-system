import Fast42 from '@codam/fast42';
import { prisma, syncData } from './base';
import { CAMPUS_ID, CURSUS_ID } from '../env';

export const syncCursusUser = async function(cursusUser: any): Promise<void> {
	try {
		await prisma.intraCursusUser.upsert({
			where: {
				id: cursusUser.id,
			},
			update: {
				begin_at: new Date(cursusUser.begin_at),
				end_at: cursusUser.end_at ? new Date(cursusUser.end_at) : null,
				level: cursusUser.level,
				grade: cursusUser.grade ? cursusUser.grade : null,
				updated_at: new Date(cursusUser.updated_at),
			},
			create: {
				id: cursusUser.id,
				cursus_id: cursusUser.cursus.id,
				begin_at: new Date(cursusUser.begin_at),
				end_at: cursusUser.end_at ? new Date(cursusUser.end_at) : null,
				level: cursusUser.level,
				grade: cursusUser.grade ? cursusUser.grade : null,
				created_at: new Date(cursusUser.created_at),
				updated_at: new Date(cursusUser.updated_at),
				user: {
					connect: {
						id: cursusUser.user.id,
					},
				},
			}
		});
	}
	catch (err) {
		console.error(`Error syncing cursus_user ${cursusUser.user.login} - ${cursusUser.cursus.name}: ${err}`);
	}
}

export const syncCursusUsers = async function(api: Fast42, syncSince: Date, syncDate: Date): Promise<void> {
	console.log(`Synchronizing cursus_users from Intra...`);

	// Fetch all users from the API updated since the last synchronization
	const cursusUsers = await syncData(api, syncDate, syncSince, `/cursus_users`, {
		'filter[campus_id]': `${CAMPUS_ID}`,
		'filter[cursus_id]': CURSUS_ID,
	});

	// Insert or update each cursus_user in the database
	let i = 0;
	const total = cursusUsers.length;
	for (const cursusUser of cursusUsers) {
		console.debug(`Syncing cursus_user ${++i}/${total} (${cursusUser.user.login} - ${cursusUser.cursus.name})...`);
		await syncCursusUser(cursusUser);
	}
};
