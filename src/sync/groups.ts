import Fast42 from '@codam/fast42';
import { prisma, syncData, syncDataCB } from './base';
import { ASSISTANT_GROUP_ID } from '../env';

export const syncGroups = async function(api: Fast42, syncSince: Date, syncDate: Date): Promise<void> {
	console.log(`Synchronizing groups from Intra...`);

	// We only sync the assistant group for now (id defined in ASSISTANT_GROUP_ID)
	const groups = await syncData(api, syncDate, syncSince, `/groups/${ASSISTANT_GROUP_ID}`, {});
	if (groups.length === 0) {
		console.error(`Assistant group with id ${ASSISTANT_GROUP_ID} not found in Intra. Skipping group synchronization.`);
		return;
	}

	for (const group of groups) { // Use for loop for in case we sync more groups in the future
		console.debug(`Syncing group ${group.id} (${group.name})...`);
		try {
			await prisma.intraGroup.upsert({
				where: {
					id: group.id,
				},
				update: {
					name: group.name,
				},
				create: {
					id: group.id,
					name: group.name,
				}
			});
		}
		catch (err) {
			console.error(`Error syncing group ${group.id}: ${err}`);
		}
	}
};

export const syncGroupsUsers = async function(api: Fast42, syncDate: Date): Promise<void> {
	console.log(`Synchronizing group users from Intra...`);

	const groups = await prisma.intraGroup.findMany({});

	for (const group of groups) {
		// We can use callback here as it is not important to have this data in the database right away for the next steps of the synchronization
		await syncDataCB(api, syncDate, undefined, `/groups/${group.id}/groups_users`, {}, async (groupsUsers) => {
			// Delete all group_users
			await prisma.intraGroupUser.deleteMany({
				where: {
					group_id: group.id,
				},
			});

			for (const groupUser of groupsUsers) {
				console.debug(`Syncing a group_user (user ${groupUser.user_id} in group "${groupUser.group.name}")...`);

				try {
					const user = await prisma.intraUser.findFirst({
						where: {
							id: groupUser.user_id,
						},
						select: {
							id: true, // Minimal select to check if user exists
						},
					});
					if (!user) {
						continue; // User is likely not from our campus
					}

					await prisma.intraGroupUser.upsert({
						where: {
							id: groupUser.id,
						},
						update: {
							user_id: groupUser.user_id,
						},
						create: {
							id: groupUser.id,
							user: {
								connect: {
									id: groupUser.user_id,
								},
							},
							group: {
								connect: {
									id: groupUser.group.id,
								},
							},
						}
					});
				}
				catch (err) {
					console.error(`Error syncing group_user ${groupUser.id}: ${err}`);
				}
			}
		});
	}
};
