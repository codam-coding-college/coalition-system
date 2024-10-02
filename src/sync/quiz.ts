import { prisma } from './base';

export const initCodamQuiz = async function(): Promise<void> {
	// Check if settings already exist
	const quizSettings = await prisma.codamCoalitionTestSettings.findFirst();
	if (quizSettings === null) {
		await prisma.codamCoalitionTestSettings.create({
			data: {
				id: 1,
				start_at: new Date(),
				deadline_at: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
			},
		});
	}
};
