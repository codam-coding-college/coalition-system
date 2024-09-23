import express from 'express';
import { Express, Request, Response } from "express";
import passport from 'passport';
import { CustomSessionData } from '../handlers/session';
import { CodamCoalition, CodamCoalitionTestAnswer, CodamCoalitionTestQuestion, PrismaClient } from '@prisma/client';
import { ExpressIntraUser } from '../sync/oauth';

export interface QuizSessionQuestion {
	question: CodamCoalitionTestQuestion;
	answers: CodamCoalitionTestAnswer[];
	progress: number;
	total: number;
}

const getQuestionById = async function(prisma: PrismaClient, questionId: number) {
	const question = await prisma.codamCoalitionTestQuestion.findUnique({
		where: {
			id: questionId
		}
	});
	if (!question) {
		throw new Error('Question not found');
	}
	const answers = await prisma.codamCoalitionTestAnswer.findMany({
		where: {
			question_id: question.id
		},
		select: {
			id: true,
			answer: true,
		}
	});
	// Randomize the order of the answers so that the same coalition's answer isn't always in the same position
	answers.sort(() => Math.random() - 0.5);
	return {question, answers};
}

const areAllQuestionsAnswered = async function(prisma: PrismaClient, userSession: CustomSessionData): Promise<boolean> {
	const questionCount = await prisma.codamCoalitionTestQuestion.count();
	if (questionCount === 0) {
		return true;
	}
	if (!userSession.quiz || !userSession.quiz.questionsAnswered) {
		return false;
	}
	return userSession.quiz.questionsAnswered.length >= questionCount;
}

export const setupQuizRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/quiz', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async function(req, res) {
		res.render('quiz.njk');
	});

	app.get('/quiz/results', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async function(req: Request, res: Response) {
		try {
			const user = req.user as ExpressIntraUser;
			console.log(`User ${user.login} requested quiz results`);
			const userSession: CustomSessionData = req.session as unknown as CustomSessionData;

			if (!userSession.quiz || !userSession.quiz.coalitionScores || !areAllQuestionsAnswered(prisma, userSession)) {
				return res.status(400).send({ error: 'Not all questions have been answered' });
			}

			const coalitionScores = userSession.quiz.coalitionScores;
			const highestScoringCoalitionId = Object.keys(coalitionScores).reduce((a, b) => coalitionScores[parseInt(a)] > coalitionScores[parseInt(b)] ? a : b);
			const coalition = await prisma.intraCoalition.findUnique({
				where: {
					id: parseInt(highestScoringCoalitionId)
				},
				select: {
					id: true,
					name: true,
					image_url: true,
					color: true,
					codam_coalition: {
						select: {
							description: true
						}
					}
				},
			});
			if (!coalition) {
				console.error(`Coalition ${highestScoringCoalitionId} not found`);
				return res.status(500).send({ error: 'Internal server error' });
			}

			console.log(`User ${user.login} scored highest with coalition ${coalition.name}`);
			console.log(userSession.quiz);
			return res.status(200).send({
				coalition
			});
		}
		catch (err) {
			console.error(err);
			return res.status(500).send({ error: 'Internal server error' });
		}
	});

	// Get a quiz question in JSON format
	app.get('/quiz/question', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async function(req: Request, res: Response): Promise<Response<QuizSessionQuestion>> {
		try {
			const user = req.user as ExpressIntraUser;
			console.log(`User ${user.login} requested a new quiz question`);
			const userSession: CustomSessionData = req.session as unknown as CustomSessionData;

			const questionCount = await prisma.codamCoalitionTestQuestion.count();
			if (questionCount === 0) {
				console.warn('No quiz questions available');
				res.status(501).send({ error: 'No quiz questions available' });
			}

			// Check if there is a current question in the session and if it was left unanswered
			if (userSession.quiz) {
				const currentQuestionId = userSession.quiz.currentQuestionId || null;
				const answeredQuestions = userSession.quiz.questionsAnswered || [];
				if (currentQuestionId && answeredQuestions.indexOf(currentQuestionId) == -1) {
					// User hasn't answered the question yet, return the same question
					console.log(`User ${user.login} requested a new question, but they haven't answered the current one yet`);
					const { question, answers } = await getQuestionById(prisma, currentQuestionId);
					return res.status(200).send({
						question,
						answers,
						progress: answeredQuestions.length,
						total: questionCount,
					});
				}
			}
			else {
				userSession.quiz = {
					currentQuestionId: null,
					questionsAnswered: [],
					coalitionScores: {},
				};
			}

			// Fetch all questions that the user hasn't answered yet
			const unansweredQuestions = await prisma.codamCoalitionTestQuestion.findMany({
				where: {
					id: {
						notIn: userSession.quiz.questionsAnswered || []
					},
				},
			});
			if (unansweredQuestions.length === 0) {
				console.log('No more questions available, user should refer to the results');
				return res.status(200).send({
					question: null,
					answers: [],
					progress: questionCount,
					total: questionCount,
					debug: 'No more questions available, refer to the results'
				});
			}

			// Pick a random question from the list of unanswered questions
			const randomQuestionId = unansweredQuestions[Math.floor(Math.random() * unansweredQuestions.length)];
			const { question, answers } = await getQuestionById(prisma, randomQuestionId.id);
			if (answers.length <= 1) {
				console.warn(`Question ${question.id} has less than 2 answers!`);
				return res.status(501).send({ error: 'Not enough answers for the question' });
			}

			// Store the question ID in the session
			userSession.quiz.currentQuestionId = question.id;
			await req.session.save();
			console.log(userSession.quiz);

			// Return the question and answers in JSON format
			return res.status(200).send({
				question,
				answers,
				progress: userSession.quiz.questionsAnswered?.length,
				total: questionCount,
			});
		}
		catch (err) {
			console.error(err);
			return res.status(500).send({ error: 'Internal server error' });
		}
	});

	// Parse form data for the answer given to a quiz question
	app.post('/quiz/answer', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async function(req: Request, res: Response) {
		try {
			const user = req.user as ExpressIntraUser;
			console.log(`User ${user.login} posted an answer to a quiz question`);
			const userSession: CustomSessionData = req.session as unknown as CustomSessionData;
			if (!userSession.quiz) {
				return res.status(400).send({ error: 'No quiz session data, request a question first' });
			}

			// Get the current question ID from the session
			const currentQuestionId = userSession.quiz.currentQuestionId;
			if (!currentQuestionId) {
				console.warn('No current question ID in session');
				return res.status(400).send({ error: 'No current question ID' });
			}

			// Get the answer ID from the form data
			const answerId = parseInt(req.body.answer_id);
			if (isNaN(answerId)) {
				console.warn('Invalid answer ID in body');
				return res.status(400).send({ error: 'Invalid answer ID' });
			}

			// Get the answer and check if it belongs to the current question
			const answer = await prisma.codamCoalitionTestAnswer.findUnique({
				where: {
					id: answerId
				}
			});
			if (!answer) {
				console.warn(`Answer ${answerId} not found`);
				return res.status(400).send({ error: 'Invalid answer ID' });
			}
			const question = await prisma.codamCoalitionTestQuestion.findUnique({
				where: {
					id: currentQuestionId
				},
				include: {
					answers: true
				}
			});
			if (!question) {
				console.warn(`Question ${currentQuestionId} not found`);
				return res.status(412).send({ error: 'Question not found' });
			}

			// Check if the answer belongs to the question
			if (question.answers.findIndex((a) => a.id === answer.id) === -1) {
				console.warn(`Answer ${answer.id} does not belong to question ${question.id}`);
				return res.status(400).send({ error: 'Invalid answer ID' });
			}

			// Initialize the quiz answers session data if this is the first question to be answered
			if (!userSession.quiz.questionsAnswered || !userSession.quiz.coalitionScores) {
				userSession.quiz.questionsAnswered = [];
				userSession.quiz.coalitionScores = {};
				const coalitions: CodamCoalition[] = await prisma.codamCoalition.findMany();
				for (const coalition of coalitions) {
					userSession.quiz.coalitionScores[coalition.id] = 0;
				}
			}

			// Add the question ID to the list of answered questions
			userSession.quiz.questionsAnswered.push(currentQuestionId);
			// Update the score for the coalition
			if (!userSession.quiz.coalitionScores[answer.coalition_id]) {
				userSession.quiz.coalitionScores[answer.coalition_id] = 0;
			}
			userSession.quiz.coalitionScores[answer.coalition_id] += answer.weight;
			await req.session.save();
			console.log(userSession.quiz);

			// Let the client know the answer was accepted and that they can request a new question
			return res.status(204).send();
		}
		catch (err) {
			console.error(err);
			return res.status(500).send({ error: 'Internal server error' });
		}
	});
};
