import { prisma, fetchSingle42ApiPage, fetchMultiple42ApiPages } from './base';
import Fast42 from '@codam/fast42';
import { syncUser } from './users';
import { getCoalitionIds } from '../utils';

const checkForDeletedCoalitionUsers = async function(api: Fast42): Promise<void> {
	// Fetch all of our coalition ids
	const coalitionIds = await getCoalitionIds(prisma);

	// Fetch all users from the API updated since the last shutdown
	console.log('Cleaning up non-existing coalition users...');
	const coalitionUsers = await fetchMultiple42ApiPages(api, `/coalitions_users`, {
		'filter[coalition_id]': Object.values(coalitionIds).join(','),
	});

	// Fetch all coalition users from our database that are not in the API response
	const nonExistentCoalitionUsers = await prisma.intraCoalitionUser.findMany({
		where: {
			NOT: {
				id: {
					in: coalitionUsers.map((coalitionUser) => coalitionUser.id),
				}
			},
		},
		include: {
			user: {
				select: {
					login: true,
				},
			},
			coalition: {
				select: {
					name: true,
				},
			}
		},
	});
	console.log(`Found ${nonExistentCoalitionUsers.length} coalition users that are not in the API response:`);
	for (const coalitionUser of nonExistentCoalitionUsers) {
		console.log(`Deleting local coalition user ${coalitionUser.id} (${coalitionUser.user.login} in ${coalitionUser.coalition.name})...`);
		await prisma.intraCoalitionUser.delete({
			where: {
				id: coalitionUser.id,
			},
		});
	}
};

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
	console.log(`Found ${users.length} users to anonymize...`);

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
	await checkForDeletedCoalitionUsers(api);
};
