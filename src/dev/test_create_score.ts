import Fast42 from "@codam/fast42";
import { PrismaClient } from '@prisma/client';
import { INTRA_API_UID, INTRA_API_SECRET } from "../env";
const prisma = new PrismaClient();

const createScore = async function(api: Fast42, login: string): Promise<void> {
	const user = await prisma.intraUser.findFirst({
		where: {
			login: login,
		}
	});
	if (!user) {
		throw new Error(`No user found in DB for login ${login}.`);
	}
	const coalitionUser = await prisma.intraCoalitionUser.findFirst({
		where: {
			user_id: user.id,
		},
		include: {
			coalition: true,
		}
	});
	if (!coalitionUser) {
		throw new Error('No coalition user found for user.');
	}
	const coalitionId = coalitionUser.coalition.id;
	// const coalitionId = 58;

	// CREATE SCORE
	console.log(`Creating testing score for coalition ${coalitionId} with user ${user.login}...`);
	const postreq = await api.post(`/coalitions/${coalitionId}/scores`, {
		"score": {
			"reason": "[CCS-test] Test score for Codam's Coalition System, please ignore...",
			"value": 42,
			"coalitions_user_id": coalitionUser.id,
			"scoreable_type": "Location",
			"scoreable_id": 1,
			"calculation_id": null,
		}
	});
	const scoreCreationBody = await postreq.json();
	console.log('Score created:', scoreCreationBody);

	// GET SCORE (DOUBLE CHECK)
	console.log('Fetching score...');
	const getreq = await api.get(`/scores/${scoreCreationBody.id}`);
	const score = await getreq.json();
	console.log('Fetched score:', score);

	// COMPARE POST VS GET SCORE
	for (const postKey of Object.keys(scoreCreationBody)) {
		if (score[postKey] !== scoreCreationBody[postKey]) {
			console.warn(`[MISMATCH] Mismatch in score field ${postKey}: POST ${scoreCreationBody[postKey]} != GET ${score[postKey]}`);
		}
		else {
			console.log(`[OK] Match in score field ${postKey}: POST ${scoreCreationBody[postKey]} == GET ${score[postKey]}`);
		}
	}

	// DELETE SCORE
	console.log('Press a key to delete the score...');
	await new Promise((resolve) => process.stdin.once('data', resolve));
	console.log('Deleting score...');
	const delreq = await api.delete(`/coalitions/${coalitionId}/scores/${scoreCreationBody.id}`, {});
	if (delreq.ok) {
		console.log('Score deleted.');
	}
	else {
		console.warn('Failed to delete score:', await delreq.text());
	}
};

const main = async function(): Promise<void> {
	const api = await new Fast42([{
		client_id: INTRA_API_UID,
		client_secret: INTRA_API_SECRET,
	}]).init();
	// Get login from CLI arguments
	const login = process.argv[2];
	if (!login) {
		throw new Error('No login provided as CLI argument.');
	}
	await createScore(api, login);
};

main().then(() => {
	process.exit(0);
});
