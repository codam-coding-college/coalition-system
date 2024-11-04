import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TYPE_POINT_DONATED = 'point_donated';

const main = async function(): Promise<void> {
	const newFixedPointType = await prisma.codamCoalitionFixedType.findFirst({
		where: {
			type: TYPE_POINT_DONATED,
		}
	});
	if (!newFixedPointType) {
		throw new Error('No point_donated fixed type found');
	}
	const scores = await prisma.codamCoalitionScore.findMany({
		where: {
			fixed_type_id: TYPE_POINT_DONATED,
		},
	});
	console.log(`Found ${scores.length} scores`);
	for (const score of scores) {
		// Parse amount of points donated from the reason... no better way ATM
		const pointsDonated = parseInt(score.reason.split(' ')[1]);
		if (isNaN(pointsDonated)) {
			throw new Error('Invalid amount of points');
		}
		const newAmount = pointsDonated * newFixedPointType.point_amount;
		await prisma.codamCoalitionScore.update({
			where: {
				id: score.id,
			},
			data: {
				amount: newAmount,
			},
		});
		console.log(`Updated score ${score.id} from ${score.amount} to ${newAmount}`);
	}
};

main().then(() => {
	try {
		console.log('Done');
		process.exit(0);
	}
	catch (err) {
		console.error(err);
		process.exit(1);
	}
});
