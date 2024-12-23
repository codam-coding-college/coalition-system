import { getAPIClient } from "../utils";
import { fetchMultiple42ApiPagesCallback } from "../sync/base";
import Fast42 from "@codam/fast42";
import { PrismaClient } from '@prisma/client';
import { INTRA_API_UID, INTRA_API_SECRET } from "../env";
const prisma = new PrismaClient();

const createScore = async function(api: Fast42): Promise<void> {
	const coalition = await prisma.intraCoalition.findFirst({});
	if (!coalition) {
		throw new Error('No coalition found in DB.');
	}
	const coalitionUser = await prisma.intraCoalitionUser.findFirst({
		where: {
			coalition_id: coalition.id,
		}
	});
	if (!coalitionUser) {
		throw new Error('No coalition user found in DB for given coalition.');
	}

	// CREATE SCORE
	console.log(`Creating testing score for coalition ${coalition.id} with user ${coalitionUser.user_id}...`);
	const postreq = await api.post(`/coalitions/${coalition.id}/scores`, {
		"score": {
			"reason": "[CCS-test] Test score for Codam's Coalition System, please ignore...",
			"value": 42,
			"coalitions_users_id": coalitionUser.id,
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
	console.log('Deleting score...');
	const delreq = await api.delete(`/coalitions/${coalition.id}/scores/${scoreCreationBody.id}`, {});
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
	await createScore(api);
};

main().then(() => {
	process.exit(0);
});
