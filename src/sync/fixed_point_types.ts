import { prisma } from './base';

const createFixedTypeIfNotExists = async function(type: string, desc: string): Promise<void> {
	const fixedPointType = await prisma.codamCoalitionFixedType.findFirst({
		where: {
			type: type,
		},
	});
	if (fixedPointType === null) {
		await prisma.codamCoalitionFixedType.create({
			data: {
				type: type,
				description: desc,
				point_amount: 0, // an admin will need to set this later using the admin interface
			},
		});
	}
};

export const initCodamCoalitionFixedTypes = async function(): Promise<void> {
	const fixedTypes = [
		{
			type: "project",
			desc: "Factor for each project completed; (mark * factor) + (difficulty * (mark / 100) / factor^1.25)",
			// recommended point amount: 8
		},
		{
			type: "evaluation",
			desc: "Each evaluation given will grant the student with this amount of points",
			// recommended point amount: 20
		},
		{
			type: "logtime",
			desc: "Every logtime hour will grant the student with this amount of points",
			// recommended point amount: 10
		},
		{
			type: "exam",
			desc: "Each exam passed will grant the student with this amount of points",
			// recommended point amount: 1000
		},
		{
			type: "event_basic",
			desc: "Each basic event organized will grant the student with this amount of points. Refer to the Coalition 2024 Set-up to view event criteria",
			// recommended point amount: 1000
		},
		{
			type: "event_intermediate",
			desc: "Each intermediate event organized will grant the student with this amount of points. Refer to the Coalition 2024 Set-up to view event criteria",
			// recommended point amount: 3000
		},
		{
			type: "event_advanced",
			desc: "Each advanced event organized will grant the student with this amount of points. Refer to the Coalition 2024 Set-up to view event criteria",
			// recommended point amount: 6000
		},
	];

	for (const fixedType of fixedTypes) {
		await createFixedTypeIfNotExists(fixedType.type, fixedType.desc);
	}
};
