import { PrismaClient } from '@prisma/client';
import Fast42 from '@codam/fast42';
const prisma = new PrismaClient();
import readline from 'readline';

const main = async function(): Promise<void> {
	console.log('This will delete all scores from Intra. Scores are kept locally. Are you sure you want to continue? (yes/no)');
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	if (await new Promise((resolve) => {
		rl.question('', (answer) => {
			rl.close();
			resolve(answer);
		});
	}) !== 'yes') {
		console.log('Aborting...');
		process.exit(0);
	}
	const scoresSynced = await prisma.codamCoalitionScore.findMany({
		where: {
			intra_score_id: {
				not: null,
			},
		},
	});

	const api = await new Fast42([{
		client_id: process.env.INTRA_API_UID!,
		client_secret: process.env.INTRA_API_SECRET!,
	}]).init();

	let i = 0;
	const total = scoresSynced.length;
	for (const score of scoresSynced) {
		console.debug(`Deleting Intra score ${++i}/${total} (${score.intra_score_id})...`);
		const del = await api.delete(`/coalitions/${score.coalition_id}/scores/${score.intra_score_id}`, {});
		if (!del.ok) {
			console.warn(`Failed to delete Codam score ${score.id}'s Intra score (${score.intra_score_id}), HTTP status ${del.status} ${del.statusText}`);
			continue;
		}
		await prisma.codamCoalitionScore.update({
			where: {
				id: score.id,
			},
			data: {
				intra_score_id: null,
			},
		});
	}
	if (total === 0) {
		console.log('No scores to delete.');
	}
};

main().then(() => {
	console.log('Done.');
	process.exit(0);
});
