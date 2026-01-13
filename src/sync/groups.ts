import Fast42 from '@codam/fast42';
import { prisma, syncDataCB } from './base';
import { ASSISTANT_GROUP_ID } from '../env';

export const syncGroups = async function(api: Fast42, syncSince: Date, syncDate: Date): Promise<void> {
	// We only sync the assistant group (id defined in ASSISTANT_GROUP_ID)
	await syncDataCB(api, syncDate, syncSince, `/groups/${ASSISTANT_GROUP_ID}`, {}, async (group) => {
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
	});
};

export const syncGroupsUsers = async function(api: Fast42, syncDate: Date): Promise<void> {
	const groups = await prisma.intraGroup.findMany({});

	for (const group of groups) {
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
