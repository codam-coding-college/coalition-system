import { prisma, fetchSingle42ApiPage } from './base';
import Fast42 from '@codam/fast42';
import { syncUser } from './users';

const anonymizeUsers = async function(api: Fast42): Promise<void> {
	// Fetch all users where the anonymize_date is in the past, not null and the login does not yet start with 3b3
	const users = await prisma.intraUser.findMany({
		where: {
			anonymize_date: {
				lt: new Date(),
				not: null,
				gt: new Date('1970-01-01'), // timestamp > 0
			},
			login: {
				not: {
					startsWith: '3b3',
				},
			},
		},
	});

	// Request the anonymized data from the API and overwrite the local data
	// Only works with staff API key
	for (const user of users) {
		try {
			console.log(`Anonymizing user ${user.id}...`);
			const anonymizedData = await fetchSingle42ApiPage(api, `/users/${user.id}`, {});
			if (!anonymizedData.user) {
				console.warn(`User ${user.id} not returned by API, cannot anonymize!`);
				continue;
			}
			await syncUser(anonymizedData.user);
		}
		catch (err) {
			console.error(`Error anonymizing user ${user.id}: ${err}`);
		}
	}
};

export const cleanupDB = async function(api: Fast42): Promise<void> {
	console.info('Cleaning up the database...');
	await anonymizeUsers(api);
};
