import { prisma } from './base';

const createFixedTypeIfNotExists = async function(type: string, desc: string, points: number): Promise<void> {
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
				point_amount: points,
			},
		});
	}
};

export const initCodamCoalitionFixedTypes = async function(): Promise<void> {
	const fixedTypes = [
		{
			type: "project",
			desc: "Factor for each project completed; (mark * factor) + (difficulty * (mark / 100) / factor^1.25)",
			points: 7, // recommended (factor)
		},
		{
			type: "evaluation",
			desc: "Each evaluation given will grant the student with this amount of points",
			points: 20, // recommended
		},
		{
			type: "logtime",
			desc: "Every logtime hour will grant the student with this amount of points",
			points: 10, // recommended
		},
		{
			type: "exam",
			desc: "Each exam passed will grant the student with this amount of points",
			points: 1000, // recommended
		},
		{
			type: "event_basic",
			desc: "Each basic event organized will grant the student with this amount of points. Refer to the Coalition 2024 Set-up to view event criteria",
			points: 1000, // recommended
		},
		{
			type: "event_intermediate",
			desc: "Each intermediate event organized will grant the student with this amount of points. Refer to the Coalition 2024 Set-up to view event criteria",
			points: 3000, // recommended
		},
		{
			type: "event_advanced",
			desc: "Each advanced event organized will grant the student with this amount of points. Refer to the Coalition 2024 Set-up to view event criteria",
			points: 6000, // recommended
		},
	];

	for (const fixedType of fixedTypes) {
		await createFixedTypeIfNotExists(fixedType.type, fixedType.desc, fixedType.points);
	}
};
