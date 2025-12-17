import readline from 'readline';
import Fast42 from '@codam/fast42';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PAGE_SIZE = 100;

const main = async function(): Promise<void> {
	const titles = await prisma.codamCoalitionTitle.findMany({});
	console.warn('This script will IRREVERIBLY MODIFY INTRA DATA, NOT LOCAL DATA.\nIt will unassign ALL Coalition Intra Titles defined in the local database from EVERYONE on the Intranet.');
	console.warn('The following titles will be removed from all users:');
	for (const title of titles) {
		console.warn(`- Title ID ${title.intra_title_id} (Local ID ${title.id}, Title: ${title.title})`);
	}
	console.warn('Are you sure you want to continue? (yes/no)');
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

	const api = await new Fast42([{
		client_id: process.env.INTRA_API_UID!,
		client_secret: process.env.INTRA_API_SECRET!,
	}]).init();


	for (const title of titles) {
		console.log(`Removing Intra Title ID ${title.intra_title_id} from all users having it assigned...`);
		const getreq = await api.get(`/titles/${title.intra_title_id}/titles_users`, {
			'page[size]': PAGE_SIZE.toString(),
		});
		if (!getreq.ok) {
			console.warn(`  - Failed to fetch users for title ID ${title.intra_title_id}, HTTP status ${getreq.status} ${getreq.statusText}`);
			continue;
		}
		const titles_users = await getreq.json();
		if (titles_users.length == PAGE_SIZE) {
			console.warn(`  - There might be more than ${PAGE_SIZE} users with title ID ${title.intra_title_id} assigned. Please run this script again to remove remaining users.`);
		}
		for (const titles_user of titles_users) {
			console.log(`  - Removing title ID ${title.intra_title_id} from user ID ${titles_user.user_id} (Title User ID ${titles_user.id})...`);
			const delreq = await api.delete(`/titles_users/${titles_user.id}`, {});
			console.log(`    - Deletion HTTP status: ${delreq.status} ${delreq.statusText}`);
		}
	}
};

main().then(() => {
	console.log('Done.');
	process.exit(0);
});
