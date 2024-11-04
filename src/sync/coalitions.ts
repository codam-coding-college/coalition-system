import { prisma } from './base';

// Coalition object can be an object returned by /v2/coalition/:id !
export const syncCoalition = async function(coalition: any): Promise<void> {
	try {
		await prisma.intraCoalition.upsert({
			where: {
				id: coalition.id,
			},
			update: {
				name: coalition.name,
				slug: coalition.slug,
				score: coalition.score,
				image_url: (coalition.image_url) ? coalition.image_url : null,
				cover_url: (coalition.cover_url) ? coalition.cover_url : null,
				color: coalition.color,
				user_id: coalition.user_id,
			},
			create: {
				id: coalition.id,
				name: coalition.name,
				slug: coalition.slug,
				score: coalition.score,
				image_url: (coalition.image_url) ? coalition.image_url : null,
				cover_url: (coalition.cover_url) ? coalition.cover_url : null,
				color: coalition.color,
				user_id: coalition.user_id,
			},
		});

		await prisma.codamCoalition.upsert({
			where: {
				id: coalition.id,
			},
			update: {
			},
			create: {
				// no id definition, is created by the link to intra_coalition below
				intra_coalition: {
					connect: {
						id: coalition.id,
					},
				},
				description: "",
			},
		});
	}
	catch (err) {
		console.error(`Error syncing coalition ${coalition.name}: ${err}`);
	}
};
