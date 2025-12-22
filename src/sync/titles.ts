import Fast42 from '@codam/fast42';
import { fetchMultiple42ApiPages, prisma } from './base';
import { getCoalitionTopContributors } from '../utils';
import { NODE_ENV } from '../env';

export const syncTitles = async function(api: Fast42): Promise<void> {
	// Get current ranking per coalition
	const coalitions = await prisma.codamCoalition.findMany({
		include: {
			intra_coalition: {
				select: {
					name: true,
				},
			},
		},
	});

	const now = new Date();
	for (const coalition of coalitions) {
		const query = await prisma.codamCoalitionTitle.aggregate({
			where: {
				coalition_id: coalition.id,
			},
			_max: {
				ranking: true,
			},
		});
		const rankingMax = query._max.ranking || 0;
		if (rankingMax === 0) {
			console.debug(`No titles defined for coalition ${coalition.intra_coalition.name}, skipping title synchronization...`);
			continue;
		}

		console.debug(`Fetching top ${rankingMax} contributors for coalition ${coalition.intra_coalition.name} to assign them Intra titles...`);
		const rankings = await getCoalitionTopContributors(prisma, coalition.id, "Top contributors", now, rankingMax);

		for (let i = 0; i < rankings.length; i++) {
			console.debug(`Processing title for rank ${rankings[i].rank} in coalition ${coalition.intra_coalition.name} for user ${rankings[i].user.login}...`);
			const rank = rankings[i].rank;
			const titleRecord = await prisma.codamCoalitionTitle.findFirst({
				where: {
					coalition_id: coalition.id,
					ranking: rank,
				},
			});

			if (!titleRecord) {
				console.debug(`No title found for coalition ${coalition.intra_coalition.name} rank ${rank}, skipping title synchronization...`);
				continue;
			}

			const existingTitleUser = await prisma.codamCoalitionTitleUser.findFirst({
				where: {
					user_id: rankings[i].user.id,
				},
			});
			if (existingTitleUser) {
				// Check if any changes were made
				if (existingTitleUser.title_id === titleRecord.id && existingTitleUser.intra_title_user_id !== null) {
					console.debug(`User ${rankings[i].user.login} already has title ID ${titleRecord.id} for coalition ${coalition.intra_coalition.name} rank ${rank}, skipping...`);
					continue;
				}

				// Update existing title user
				console.debug(`Updating title ID ${titleRecord.id} for user ${rankings[i].user.login} for coalition ${coalition.intra_coalition.name} rank ${rank}...`);
				await prisma.codamCoalitionTitleUser.update({
					where: {
						id: existingTitleUser.id,
					},
					data: {
						title_id: titleRecord.id,
					},
				});

				// Award title on Intra
				if (NODE_ENV === 'production') {
					if (existingTitleUser.intra_title_user_id) {
						// Existing title_user, just update the title_id connected to the user
						console.debug(`Patching Intra TitlesUser ID ${existingTitleUser.intra_title_user_id} with Intra title id ${titleRecord.intra_title_id} for user ${rankings[i].user.login} on Intra...`);
						const patch = await api.patch(`/titles_users/${existingTitleUser.intra_title_user_id}`, {
							titles_user: {
								title_id: titleRecord.intra_title_id,
							},
						});
						if (!patch.ok) {
							console.error(`Failed to update Intra user ${rankings[i].user.login} with title ID ${titleRecord.intra_title_id}, HTTP status ${patch.status} ${patch.statusText}`);
						}
					} else {
						// User hasn't had a coalition title on Intra yet, create it
						console.debug(`Creating new Intra TitlesUser with Intra title id ${titleRecord.intra_title_id} for user ${rankings[i].user.login} on Intra...`);
						const post = await api.post(`/titles_users`, {
							titles_user: {
								user_id: rankings[i].user.id,
								title_id: titleRecord.intra_title_id,
							},
						});
						if (!post.ok) {
							console.error(`Failed to create Intra title_user for user ${rankings[i].user.login} with title ID ${titleRecord.intra_title_id}, HTTP status ${post.status} ${post.statusText}`);
							if (post.status == 422) {
								try {
									const data = await post.json();
									if (data && data.errors && data.errors["title_id"] == 'has already been taken') {
										console.warn(`Intra title_user for user ${rankings[i].user.login} with title ID ${titleRecord.intra_title_id} already exists on Intra. Fetching the used titles_user ID...`);
										const titleUsers = await fetchMultiple42ApiPages(api, `/users/${rankings[i].user.id}/titles_users`);
										for (const titleUser of titleUsers) {
											if (titleUser.title_id === titleRecord.intra_title_id) {
												console.log(` - Found existing Intra title_user ID ${titleUser.id} for user ${rankings[i].user.login} with title ID ${titleRecord.intra_title_id}. Saving to database...`);
												await prisma.codamCoalitionTitleUser.update({
													where: {
														id: existingTitleUser.id,
													},
													data: {
														intra_title_user_id: titleUser.id,
													},
												});
												break;
											}
										}
									}
								} catch (err) {
									console.error(` - Failed to parse Intra API response for existing title_user for user ${rankings[i].user.login}:`, err);
								}
							}
						} else {
							const titleUserData = await post.json();
							// Save intra_title_user_id
							await prisma.codamCoalitionTitleUser.update({
								where: {
									id: existingTitleUser.id,
								},
								data: {
									intra_title_user_id: titleUserData.id,
								},
							});
						}
					}
				}
				else {
					console.debug(`Skipping Intra title assignment for user ${rankings[i].user.login} as NODE_ENV is not production.`);
				}
			}
			else {
				// Create new title user
				console.debug(`Awarding title ID ${titleRecord.id} to user ${rankings[i].user.login} for coalition ${coalition.intra_coalition.name} rank ${rank}...`);
				const newTitleUser = await prisma.codamCoalitionTitleUser.create({
					data: {
						user_id: rankings[i].user.id,
						title_id: titleRecord.id,
					},
				});

				// Award title on Intra
				if (NODE_ENV === 'production') {
					console.debug(`Creating new Intra TitlesUser with Intra title id ${titleRecord.intra_title_id} for user ${rankings[i].user.login} on Intra...`);
					const post = await api.post(`/titles_users`, {
						titles_user: {
							user_id: rankings[i].user.id,
							title_id: titleRecord.intra_title_id,
						},
					});
					if (!post.ok) {
						console.error(`Failed to create Intra title_user for user ${rankings[i].user.login} with title ID ${titleRecord.intra_title_id}, HTTP status ${post.status} ${post.statusText}`);
					} else {
						const titleUserData = await post.json();
						// Save intra_title_user_id
						await prisma.codamCoalitionTitleUser.update({
							where: {
								id: newTitleUser.id,
							},
							data: {
								intra_title_user_id: titleUserData.id,
							},
						});
					}
				}
				else {
					console.debug(`Skipping Intra title assignment for user ${rankings[i].user.login} as NODE_ENV is not production.`);
				}
			}
		}

		// Remove titles from users who have dropped out of the top rankings
		const titleUsers = await prisma.codamCoalitionTitleUser.findMany({
			include: {
				user: {
					include: {
						intra_user: {
							select: {
								login: true,
							},
						},
					},
				},
			},
			where: {
				title: {
					coalition_id: coalition.id,
				},
				user_id: {
					notIn: rankings.map((ranking) => ranking.user.id),
				},
			},
		});
		for (const titleUser of titleUsers) {
			console.log(`Removing title ID ${titleUser.title_id} from user ${titleUser.user.intra_user.login} as they have dropped out of the top rankings for coalition ${coalition.intra_coalition.name}...`);
			await prisma.codamCoalitionTitleUser.delete({
				where: {
					id: titleUser.id,
				},
			});

			// Remove title on Intra
			if (NODE_ENV === 'production' && titleUser.intra_title_user_id) {
				console.debug(`Removing Intra title_user ID ${titleUser.intra_title_user_id} for user ${titleUser.user.intra_user.login}...`);
				const del = await api.delete(`/v2/titles_users/${titleUser.intra_title_user_id}`, {});
				if (!del.ok) {
					console.error(`Failed to delete Intra title_user ID ${titleUser.intra_title_user_id} for user ID ${titleUser.user_id}, HTTP status ${del.status} ${del.statusText}`);
				}
			}
			else {
				console.debug(`Skipping Intra title removal for user ${titleUser.user.intra_user.login} as NODE_ENV is not production or intra_title_user_id is missing.`);
			}
		}
	}
};
