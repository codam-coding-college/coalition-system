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
			desc: "Each project validated will grant the student with this amount of points times the project's difficulty times their grade divided by 100",
			// recommended point amount: 1
		},
		{
			type: "evaluation",
			desc: "Each evaluation given will grant the student with this amount of points",
			// recommended point amount: 15
		},
		{
			type: "logtime",
			desc: "Every logtime hour will grant the student with this amount of points",
			// recommended point amount: 9
		},
		{
			type: "exam",
			desc: "Each exam passed will grant the student with this amount of points",
			// recommended point amount: 10 or 100
		},
		{
			type: "event_basic",
			desc: "Each basic event organized will grant the student with this amount of points. Refer to the Coalition 2024 Set-up to view event criteria",
			// recommended point amount: 10
		},
		{
			type: "event_intermediate",
			desc: "Each intermediate event organized will grant the student with this amount of points. Refer to the Coalition 2024 Set-up to view event criteria",
			// recommended point amount: 30
		},
		{
			type: "event_advanced",
			desc: "Each advanced event organized will grant the student with this amount of points. Refer to the Coalition 2024 Set-up to view event criteria",
			// recommended point amount: 60
		},
	];

	for (const fixedType of fixedTypes) {
		await createFixedTypeIfNotExists(fixedType.type, fixedType.desc);
	}
};
