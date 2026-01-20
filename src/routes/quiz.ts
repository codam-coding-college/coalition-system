import { Express, Request, Response } from "express";
import passport from 'passport';
import { CustomSessionData } from '../handlers/session';
import { CodamCoalition, CodamCoalitionTestAnswer, CodamCoalitionTestQuestion, IntraUser, PrismaClient } from '@prisma/client';
import { ExpressIntraUser } from '../sync/oauth';
import { getAPIClient } from '../utils';
import { fetchSingle42ApiPage } from '../sync/base';
import { syncCoalitionUser } from '../sync/coalitions_users';
import { ASSISTANTS_CAN_QUIZ, CURSUS_ID } from '../env';

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

export const isQuizAvailable = async function(user: IntraUser | ExpressIntraUser, prisma: PrismaClient): Promise<boolean> {
	// Check if the current settings allow taking the questionnaire
	const settings = await prisma.codamCoalitionTestSettings.findFirstOrThrow({
		where: {
			id: 1,
		},
	});
	const currentDate = new Date();
	const availableDueToTime = (currentDate.getTime() >= settings.start_at.getTime() && currentDate.getTime() < settings.deadline_at.getTime());

	// If the user is not part of any coalition currently, taking the questionnaire is always allowed, as long as their cursus is ongoing
	// Also allow assistants to take the quiz if the relevant env var is set
	const userDetails = await prisma.intraUser.findFirst({
		where: {
			id: user.id,
		},
		select: {
			coalition_users: {
				select: {
					id: true,
				},
			},
			cursus_users: {
				where: {
					AND: [ // only consider active cursus users for the relevant cursus
						{
							cursus_id: CURSUS_ID,
						},
						{
							OR: [
								{ end_at: null },
								{ end_at: { gt: currentDate } }, // also consider cursus_users that are still active at the current date
							],
						},
					],
				},
				select: {
					id: true,
					end_at: true,
				},
			},
			group_users: {
				select: {
					id: true,
				},
				where: {
					group_id: parseInt(process.env.INTRA_ASSISTANT_GROUP_ID || '0'),
				},
			},
		},
	});
	if (!userDetails) {
		console.warn(`User ${user.id} not found in database when checking quiz availability`);
		return false;
	}
	if (userDetails.coalition_users.length === 0 || availableDueToTime) {
		if (userDetails.cursus_users.length > 0 && !userDetails.cursus_users[0].end_at) {
			console.log(`User ${user.id} has an ongoing cursus in cursus ${CURSUS_ID}, allowing to take the questionnaire`);
			return true; // User has an ongoing cursus in the relevant cursus, allow taking the questionnaire
		}
		if (userDetails.group_users.length > 0 && ASSISTANTS_CAN_QUIZ) {
			console.log(`User ${user.id} is an assistant and assistants are allowed to take the quiz due to env var ASSISTANTS_CAN_QUIZ, allowing to take the questionnaire`);
			return true; // User is an assistant and assistants are allowed to take the quiz due to env var ASSISTANTS_CAN_QUIZ
		}
	}
	return false;
}

const resetQuizSession = async function(req: Request, userSession: CustomSessionData): Promise<void> {
	delete userSession.quiz;
}

export const setupQuizRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/quiz', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async function(req, res) {
		const user = req.user as ExpressIntraUser;
		console.log(`User ${user.login} requested access to the quiz`);

		if (! await isQuizAvailable(user, prisma)) {
			return res.status(403).send({ error: 'The questionnaire is currently unavailable' });
		}

		const coalitions = await prisma.intraCoalition.findMany({
			select: {
				id: true,
				name: true,
				image_url: true,
				color: true,
				codam_coalition: {
					select: {
						description: true
					}
				},
			},
		});

		return res.render('quiz.njk', {
			coalitions,
		});
	});

	app.get('/quiz/results', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async function(req: Request, res: Response) {
		try {
			const user = req.user as ExpressIntraUser;
			console.log(`User ${user.login} requested quiz results`);
			const userSession: CustomSessionData = req.session as unknown as CustomSessionData;

			if (! await isQuizAvailable(user, prisma)) {
				return res.status(403).send({ error: 'The questionnaire is currently unavailable' });
			}

			if (!userSession.quiz || !userSession.quiz.coalitionScores || !areAllQuestionsAnswered(prisma, userSession)) {
				return res.status(400).send({ error: 'Not all questions have been answered' });
			}

			const coalitionScores = userSession.quiz.coalitionScores;
			const highestScoringCoalitionId = Object.keys(coalitionScores).reduce((a, b) => coalitionScores[parseInt(a)] > coalitionScores[parseInt(b)] ? a : b);
			const coalitions = await prisma.intraCoalition.findMany({
				select: {
					id: true,
					name: true,
					image_url: true,
					color: true,
					codam_coalition: {
						select: {
							description: true
						}
					},
					// Add score property to the coalition object
					score: true,
				},
			});

			// add score to each of the coalitions to respond to the frontend
			coalitions.forEach((c) => {
				c.score = 0; // otherwise the total coalition score will overwrite the score of the questionnaire! Uses the same key
				if (c.id in coalitionScores) {
					c.score = coalitionScores[c.id];
				}
			});

			const bestScoringCoalition = coalitions.find((c) => c.id === parseInt(highestScoringCoalitionId));
			if (!bestScoringCoalition) {
				console.error(`Coalition ${highestScoringCoalitionId} not found`);
				return res.status(500).send({ error: 'Internal server error' });
			}

			console.log(`User ${user.login} scored highest with coalition ${bestScoringCoalition.name}`);
			console.log(userSession.quiz);
			return res.status(200).send({
				coalitions,
				best_fit: bestScoringCoalition,
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

			if (! await isQuizAvailable(user, prisma)) {
				return res.status(403).send({ error: 'The questionnaire is currently unavailable' });
			}

			const questionCount = await prisma.codamCoalitionTestQuestion.count();
			if (questionCount === 0) {
				console.warn('No quiz questions available');
				return res.status(501).send({ error: 'No quiz questions available' });
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

			if (! await isQuizAvailable(user, prisma)) {
				return res.status(403).send({ error: 'The questionnaire is currently unavailable' });
			}

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
			console.log(userSession.quiz);

			// Let the client know the answer was accepted and that they can request a new question
			return res.status(204).send();
		}
		catch (err) {
			console.error(err);
			return res.status(500).send({ error: 'Internal server error' });
		}
	});

	app.get('/quiz/reset', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async function(req: Request, res: Response) {
		const user = req.user as ExpressIntraUser;
		console.log(`User ${user.login} requested a new quiz question`);
		const userSession: CustomSessionData = req.session as unknown as CustomSessionData;

		// Delete the quiz session data
		await resetQuizSession(req, userSession);
		console.log(`User ${user.login} reset their quiz session`);
		return res.redirect('/quiz');
	});

	app.post('/quiz/join', passport.authenticate('session', {
		keepSessionInfo: true,
	}), async function(req: Request, res: Response) {
		const user = req.user as ExpressIntraUser;
		const userSession: CustomSessionData = req.session as unknown as CustomSessionData;
		if (! await isQuizAvailable(user, prisma)) {
			return res.status(403).send({ error: 'The questionnaire is currently unavailable' });
		}

		// Get the coalition ID defined in the POST body
		const coalitionId = parseInt(req.body.coalition_id);
		console.log(`User ${user.login} requested to join coalition ${coalitionId}`);


		// Check if coalitionId is actually in our database
		const coalition = await prisma.intraCoalition.findFirst({
			where: {
				id: coalitionId
			}
		});
		if (!coalition) {
			console.warn(`User ${user.login} tried to join a non-existing coalition ${coalitionId}`);
			return res.status(400).send({ error: 'Whatever you\'re trying to do, stop' });
		}

		// Check if all questions have been answered
		if (! await areAllQuestionsAnswered(prisma, userSession)) {
			console.log(`User ${user.login} tried to join a coalition without answering all questions`);
			return res.status(400).send({ error: 'Not all questions have been answered' });
		}

		const api = await getAPIClient();
		let joined = false;

		// Make sure the cursus_user allows for a coalition
		const cursus_users = await fetchSingle42ApiPage(api, `/cursus_users`, {
			'filter[user_id]': user.id.toString(),
			'filter[cursus_id]': CURSUS_ID.toString(),
		});
		if (cursus_users.length === 0) {
			console.error(`User ${user.login} is not enrolled in the cursus with ID ${CURSUS_ID}`);
			return res.status(412).send({ error: 'Failed to join coalition due to cursus enrollment error, try again later' });
		}

		// Patch the cursus_user to allow for a coalition if needed
		if (cursus_users[0].has_coalition === false) {
			console.log(`Patching user ${user.login}'s cursus_user to allow for a coalition in the cursus...`);
			const response = await api.patch(`/cursus_users/${cursus_users[0].id}`, {
				cursus_user: {
					has_coalition: true,
				}
			});
			console.log(`${user.login}'s cursus_user patch response: ${response.status} ${response.statusText}`);
		}

		// Temporarily reopen the cursus if it has already ended
		const cursusEndAt = cursus_users[0].end_at ? new Date(cursus_users[0].end_at) : null;
		const now = new Date();
		if (cursusEndAt && cursusEndAt < now) {
			console.log(`User ${user.login}'s cursus has already ended at ${cursusEndAt.toISOString()}. Modifying cursus_user's end_at temporarily...`);
			const endAtResponse = await api.patch(`/cursus_users/${cursus_users[0].id}`, {
				cursus_user: {
					end_at: null,
				}
			});
			if (endAtResponse.status !== 204) {
				console.error(`Failed to patch cursus_user end_at for user ${user.login}: ${endAtResponse.status} ${endAtResponse.statusText}`);
				return res.status(500).send({ error: 'Failed to join coalition due to cursus end error, try again later' });
			}
			else {
				console.log(`${user.login}'s cursus_user end_at patch response: ${endAtResponse.status} ${endAtResponse.statusText}`);
			}
		}

		try {
			// Check for an existing coalitionUser on Intra
			const coalitionIds = await prisma.intraCoalition.findMany({
				select: {
					id: true,
				},
			});
			const coalitionIdList = coalitionIds.map(c => c.id);
			const existingCoalitionUser = await fetchSingle42ApiPage(api, `/coalitions_users`, {
				'filter[user_id]': user.id.toString(),
				'filter[coalition_id]': coalitionIdList.join(','),
			});

			if (existingCoalitionUser.length > 0) {
				console.log(`Found existing IntraCoalitionUser ${existingCoalitionUser[0].id} for user ${user.login} (currently in coalition ${existingCoalitionUser[0].coalition_id}), patching using Intra API...`);
				// Patch the user's coalition ID in Intra
				const response = await api.patch(`/coalitions_users/${existingCoalitionUser[0].id}`, {
					coalitions_user: {
						coalition_id: coalitionId,
					}
				});
				if (response.status === 204) {
					existingCoalitionUser[0].coalition_id = coalitionId;
					await syncCoalitionUser(existingCoalitionUser[0]);
					console.log(`User ${user.login} joined coalition ${coalitionId} with an existing IntraCoalitionUser ${existingCoalitionUser[0].id}`);
					joined = true;
				}
				else {
					console.error(`Failed to patch coalition ID for user ${user.login}: ${response.status} ${response.statusText}`);
					throw new Error(`Failed to patch coalitionuser ${existingCoalitionUser[0].id} for user ${user.login}`);
				}
			}
			else {
				console.log(`Creating a new IntraCoalitionUser for user ${user.login} in coalition ${coalitionId}`);
				const coalitionUserCreateResponse = await api.post('/coalitions_users', {
					coalitions_user: {
						user_id: user.id,
						coalition_id: coalitionId,
						this_year_score: 0,
					}
				});

				if (coalitionUserCreateResponse.status === 201) {
					const responseBody = await coalitionUserCreateResponse.json();
					if (!responseBody.id) {
						console.error(`Expected key 'id' in response data missing`, responseBody);
						throw new Error('Expected key id in coalition user creation response missing');
					}
					const coalitionUser = await fetchSingle42ApiPage(api, `/coalitions_users/${responseBody.id}`);
					if (!coalitionUser) {
						console.error(`Failed to fetch coalition user ${responseBody.id}, was probably not created?`);
						throw new Error(`Failed to fetch coalition user ${responseBody.id} after creation`);
					}
					await syncCoalitionUser(coalitionUser);
					console.log(`User ${user.login} joined coalition ${coalitionId} with a new IntraCoalitionUser ${coalitionUser.id}`);
					joined = true;
				}
				else {
					const responseBody = await coalitionUserCreateResponse.text();
					console.error(`Failed to create coalition user for user ${user.login}: ${coalitionUserCreateResponse.status} ${coalitionUserCreateResponse.statusText} - ${responseBody}`);
					throw new Error(`Failed to create coalition user for user ${user.login}`);
				}
			}
		}
		catch (err) {
			res.status(500).send({ error: err || 'Internal server error' });
		}
		finally {
			// Make sure to restore the cursus_user's end_at date if it was modified earlier
			if (cursusEndAt && cursusEndAt < now) {
				// Restore the original end_at date
				console.log(`Restoring user ${user.login}'s cursus_user end_at to ${cursusEndAt.toISOString()}...`);
				const endAtResponse = await api.patch(`/cursus_users/${cursus_users[0].id}`, {
					cursus_user: {
						end_at: cursusEndAt.toISOString(),
					}
				});
				if (endAtResponse.status !== 204) {
					console.warn(`Failed to restore cursus_user end_at for user ${user.login}: ${endAtResponse.status} ${endAtResponse.statusText}`);
				}
				else {
					console.log(`${user.login}'s cursus_user end_at restore patch response: ${endAtResponse.status} ${endAtResponse.statusText}`);
				}
			}
		}

		if (joined) {
			await resetQuizSession(req, userSession);
			return res.redirect('/');
		}
	});
};
