import { CodamCoalition, CodamCoalitionTestAnswer, CodamCoalitionTestQuestion, PrismaClient } from '@prisma/client';
import { getCoalitionIds } from '../utils';
const prisma = new PrismaClient();

const deleteExistingQuizQuestions = async function(): Promise<void> {
	await prisma.codamCoalitionTestAnswer.deleteMany({});
	await prisma.codamCoalitionTestQuestion.deleteMany({});
};

const createQuizAnswer = async function(questionId: number, answer: string, coalitionId: number): Promise<void> {
	await prisma.codamCoalitionTestAnswer.create({
		data: {
			question_id: questionId,
			answer: answer,
			coalition_id: coalitionId,
		},
	});
};

const createQuizQuestionAnswerSet = async function(question: string, answers: { answer: string, coalition: string }[]): Promise<void> {
	const questionObj = await prisma.codamCoalitionTestQuestion.create({
		data: {
			question: question
		},
	});
	const coalitionIds = await getCoalitionIds();
	// Randomize the order of the answers to make it less obvious to the client
	// which answer belongs to which coalition (based on lower answer id in the DB = earlier created = vela, pyxis, cetus etc.)
	answers = answers.sort(() => Math.random() - 0.5);
	for (const answer of answers) {
		await createQuizAnswer(questionObj.id, answer.answer, coalitionIds[`42cursus-amsterdam-${answer.coalition}`]);
	}
};

const createQuizQuestions = async function(): Promise<void> {
	// Question 1
	await createQuizQuestionAnswerSet("I would describe myself as more:", [
		{ answer: "Competitive", coalition: "vela" },
		{ answer: "Kind", coalition: "pyxis" },
		{ answer: "Unconventional", coalition: "cetus" }
	]);

	// Question 2
	await createQuizQuestionAnswerSet("Given a team challenge, I make sure that we:", [
		{ answer: "Win", coalition: "vela" },
		{ answer: "Have fun", coalition: "pyxis" },
		{ answer: "Try different things", coalition: "cetus" }
	]);

	// Question 3
	await createQuizQuestionAnswerSet("A good day is one in which I have:", [
		{ answer: "Improved at something", coalition: "vela" },
		{ answer: "Gotten to know someone", coalition: "pyxis" },
		{ answer: "Tried something new", coalition: "cetus" }
	]);

	// Question 4
	await createQuizQuestionAnswerSet("I prefer to complete tasks by doing it:", [
		{ answer: "The best way", coalition: "vela" },
		{ answer: "Together", coalition: "pyxis" },
		{ answer: "My own way", coalition: "cetus" }
	]);
};

const main = async function(): Promise<void> {
	await deleteExistingQuizQuestions();
	await createQuizQuestions();
};

main().then(() => {
	console.log('Quiz questions created');
	process.exit(0);
});
