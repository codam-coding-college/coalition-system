import Fast42 from '@codam/fast42';
import { prisma, syncData } from './base';
import { getCoalitionIds } from '../utils';

// User object can be an object returned by /v2/users/:id or the user object in /v2/cursus_users/:id !
export const syncCoalitionUser = async function(coalitionUser: any): Promise<void> {
	try {
		// Check if user exists in our database
		const user = await prisma.intraUser.findFirst({
			where: {
				id: coalitionUser.user_id,
			},
		});
		if (!user) {
			console.warn(`User ${coalitionUser.user_id} does not exist in our database, skipping local CoalitionUser creation...`);
			return;
		}

		// Check if coalitionUser is of any of the coalitions we care about (are in our database)
		const coalitionIds = await getCoalitionIds(prisma);
		const coalitionIdsArray = Object.values(coalitionIds);
		if (!coalitionIdsArray.includes(coalitionUser.coalition_id)) {
			console.warn(`Coalition ${coalitionUser.coalition_id} is not in our database, skipping local CoalitionUser creation...`);
			return;
		}

		await prisma.intraCoalitionUser.upsert({
			where: {
				id: coalitionUser.id,
			},
			update: {
				coalition: {
					connect: {
						id: coalitionUser.coalition_id,
					},
				},
				user: {
					connect: {
						id: coalitionUser.user_id,
					},
				},
				score: coalitionUser.score,
				rank: coalitionUser.rank,
				updated_at: new Date(coalitionUser.updated_at),
			},
			create: {
				id: coalitionUser.id,
				coalition: {
					connect: {
						id: coalitionUser.coalition_id,
					},
				},
				user: {
					connect: {
						id: coalitionUser.user_id,
					},
				},
				score: coalitionUser.score,
				rank: coalitionUser.rank,
				created_at: new Date(coalitionUser.created_at),
				updated_at: new Date(coalitionUser.updated_at),
			},
		});
	}
	catch (err) {
		console.error(`Error syncing coalitionUser ${coalitionUser.id} of user ${coalitionUser.user_id}: ${err}`);
	}
};

export const syncCoalitionUsers = async function(api: Fast42, syncSince: Date, syncDate: Date): Promise<void> {
	// Fetch all of our coalition ids
	const coalitionIds = await getCoalitionIds(prisma);

	// Fetch all users from the API updated since the last shutdown
	console.log('Coalition IDs used by the coalitions_users synchronization: ', coalitionIds);
	const coalitionUsers = await syncData(api, syncDate, syncSince, `/coalitions_users`, {
		'filter[coalition_id]': Object.values(coalitionIds).join(','),
	});

	// Insert or update each user in the database
	let i = 0;
	const total = coalitionUsers.length;
	for (const coalitionUser of coalitionUsers) {
		console.debug(`Syncing coalitionUser ${++i}/${total} (${coalitionUser.id})...`);
		await syncCoalitionUser(coalitionUser);
	}
};
