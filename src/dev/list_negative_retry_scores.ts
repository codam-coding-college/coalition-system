import { prisma } from '../handlers/db';
import readline from 'readline';

// Lists all CodamCoalitionScore rows that deducted points from a user as a
// result of a project or exam retry (amount < 0, fixed_type_id in {project, exam}).
//
// Before the fix in handlers/points.ts (PR #24), handleFixedPointScore would
// happily write a negative score row whenever a retry's new total ended up
// lower than the sum of previously awarded points (e.g. because an admin
// lowered point_amount, or Intra updated project.difficulty between attempts).
//
// Run with `--revert` to delete the listed rows after a confirmation prompt.
// Without the flag this is read-only.

const TYPES = ['project', 'exam'];

const main = async function(): Promise<void> {
	const revert = process.argv.includes('--revert');

	const rows = await prisma.codamCoalitionScore.findMany({
		where: {
			amount: { lt: 0 },
			fixed_type_id: { in: TYPES },
		},
		include: {
			user: { select: { intra_user: { select: { login: true } } } },
			coalition: { select: { intra_coalition: { select: { name: true } } } },
		},
		orderBy: [{ user_id: 'asc' }, { created_at: 'asc' }],
	});

	if (rows.length === 0) {
		console.log('No negative project/exam scores found. Nothing to do.');
		return;
	}

	console.log(`Found ${rows.length} negative project/exam score row(s):\n`);
	console.log('id\tuser\tcoalition\ttype\tamount\ttype_intra_id\treason');
	console.log('-'.repeat(80));

	const totalsByUser = new Map<string, number>();
	let grandTotal = 0;
	for (const row of rows) {
		const login = row.user.intra_user?.login ?? `user#${row.user_id}`;
		console.log([
			row.id,
			login,
			row.coalition.intra_coalition.name,
			row.fixed_type_id,
			row.amount,
			row.type_intra_id ?? '',
			row.reason,
		].join('\t'));
		totalsByUser.set(login, (totalsByUser.get(login) ?? 0) + row.amount);
		grandTotal += row.amount;
	}

	console.log('\nTotal deducted per user:');
	for (const [login, total] of [...totalsByUser.entries()].sort((a, b) => a[1] - b[1])) {
		console.log(`  ${login}\t${total}`);
	}
	console.log(`\nGrand total: ${grandTotal} points across ${totalsByUser.size} user(s).`);

	if (!revert) {
		console.log('\nRead-only run. Re-run with `--revert` to delete these rows.');
		return;
	}

	console.log(`\nAbout to DELETE the ${rows.length} row(s) listed above. Type "yes" to confirm.`);
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const answer: string = await new Promise((resolve) => {
		rl.question('', (a) => { rl.close(); resolve(a); });
	});
	if (answer !== 'yes') {
		console.log('Aborting, nothing was deleted.');
		return;
	}

	const result = await prisma.codamCoalitionScore.deleteMany({
		where: { id: { in: rows.map((r) => r.id) } },
	});
	console.log(`Deleted ${result.count} row(s).`);
};

main().then(() => {
	process.exit(0);
}).catch((err) => {
	console.error(err);
	process.exit(1);
});
