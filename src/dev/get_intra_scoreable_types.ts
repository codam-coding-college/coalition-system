import { fetchMultiple42ApiPagesCallback } from "../sync/base";
import Fast42 from "@codam/fast42";
import { PrismaClient } from '@prisma/client';
import { INTRA_API_UID, INTRA_API_SECRET } from "../env";
const prisma = new PrismaClient();

const getAllScoreableTypes = async function(api: Fast42): Promise<void> {
	const coalition = await prisma.intraCoalition.findFirst({});
	if (!coalition) {
		throw new Error('No coalition found in DB.');
	}
	const scoreableTypes: any[] = [];
	const exampleIds: { [key: string]: number } = {};
	const exampleReasons: { [key: string]: string } = {};
	const exampleCalculationIds: { [key: string]: number } = {};
	await fetchMultiple42ApiPagesCallback(api, `/coalitions/${coalition.id}/scores`, {}, (data, xPage, xTotal) => {
		console.log(`Fetched page ${xPage}...`);
		for (const score of data) {
			if (!scoreableTypes.includes(score.scoreable_type)) {
				scoreableTypes.push(score.scoreable_type);
				if (score.scoreable_type) {
					exampleIds[score.scoreable_type] = score.scoreable_id;
					exampleReasons[score.scoreable_type] = score.reason;
					exampleCalculationIds[score.scoreable_type] = score.calculation_id;
				}
			}
		}
	});
	console.log('Scoreable types:', scoreableTypes);
	console.log('Example IDs:', exampleIds);
	console.log('Example reasons:', exampleReasons);
	console.log('Example calculation IDs:', exampleCalculationIds);
};

const main = async function(): Promise<void> {
	const api = await new Fast42([{
		client_id: INTRA_API_UID,
		client_secret: INTRA_API_SECRET,
	}]).init();
	await getAllScoreableTypes(api);
};

main().then(() => {
	process.exit(0);
});
