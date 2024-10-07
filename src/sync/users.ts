import Fast42 from '@codam/fast42';
import { prisma, syncData } from './base';
import { CAMPUS_ID, LAST_SYNC_TIMESTAMP } from '../env';

// User object can be an object returned by /v2/users/:id or the user object in /v2/cursus_users/:id !
export const syncUser = async function(user: any): Promise<void> {
	try {
		await prisma.intraUser.upsert({
			where: {
				id: user.id,
			},
			update: {
				login: user.login, // required for anonymization
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
				usual_first_name: user.usual_first_name,
				usual_full_name: user.usual_full_name,
				display_name: user.displayname,
				pool_month: user.pool_month,
				pool_year: user.pool_year,
				anonymize_date: new Date(user.anonymize_date),
				updated_at: new Date(user.updated_at),
				image: (user.image && user.image.versions && user.image.versions.large) ? user.image.versions.large : null,
			},
			create: {
				id: user.id,
				login: user.login,
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
				usual_first_name: user.usual_first_name,
				usual_full_name: user.usual_full_name,
				display_name: user.displayname,
				pool_month: user.pool_month,
				pool_year: user.pool_year,
				anonymize_date: new Date(user.anonymize_date),
				created_at: new Date(user.created_at),
				updated_at: new Date(user.updated_at),
				kind: user.kind,
				image: (user.image && user.image.versions && user.image.versions.large) ? user.image.versions.large : null,
			},
		});

		await prisma.codamUser.upsert({
			where: {
				id: user.id,
			},
			update: {
			},
			create: {
				id: user.id,
			}
		});
	}
	catch (err) {
		console.error(`Error syncing user ${user.login}: ${err}`);
	}
};

export const syncUsers = async function(api: Fast42, syncDate: Date): Promise<void> {
	// Fetch the time of the last shutdown
	const syncSince = new Date(LAST_SYNC_TIMESTAMP);

	// Fetch all users from the API updated since the last shutdown
	const users = await syncData(api, syncDate, syncSince, `/campus/${CAMPUS_ID}/users`, {});

	// Insert or update each user in the database
	let i = 0;
	const total = users.length;
	for (const user of users) {
		console.debug(`Syncing user ${++i}/${total} (${user.login})...`);
		await syncUser(user);
	}
};
