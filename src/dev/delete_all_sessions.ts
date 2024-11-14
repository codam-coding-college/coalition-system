import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import readline from 'readline';

const main = async function(): Promise<void> {
	console.log('This will delete all sessions from the database. Are you sure you want to continue? (yes/no)');
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
	await prisma.session.deleteMany({});
};

main().then(() => {
	console.log('All sessions have been deleted from the database');
	process.exit(0);
});