import { Express } from 'express';
import { PrismaClient } from '@prisma/client';

export const setupAdminQuizRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/quiz', async (req, res) => {
		// Fetch all coalitions
		const coalitions = await prisma.intraCoalition.findMany({
			select: {
				id: true,
				name: true,
			},
		});

		// Fetch all quiz questions and corresponding answers
		const questions = await prisma.codamCoalitionTestQuestion.findMany({
			select: {
				id: true,
				question: true,
				answers: {
					select: {
						id: true,
						answer: true,
						weight: true,
						coalition: {
							select: {
								intra_coalition: {
									select: {
										name: true,
									},
								},
							},
						},
					},
				},
			},
		});

		return res.render('admin/quiz.njk', {
			questions,
			coalitions,
		});
	});

	// Redirect to question in quiz settings
	app.get('/admin/quiz/questions/:id', async (req, res) => {
		const question = await prisma.codamCoalitionTestQuestion.findFirst({
			where: {
				id: parseInt(req.params.id),
			},
			select: {
				id: true,
			}
		});
		if (!question) {
			return res.status(404).send('Question not found');
		}
		return res.redirect(`/admin/quiz#question-${question.id}`);
	});

	// Redirect to the question the answer belongs to in the quiz settings
	app.get('/admin/quiz/answers/:id', async (req, res) => {
		const answer = await prisma.codamCoalitionTestAnswer.findFirst({
			where: {
				id: parseInt(req.params.id),
			},
			select: {
				id: true,
				question_id: true,
			}
		});
		if (!answer) {
			return res.status(404).send('Answer not found');
		}
		return res.redirect(`/admin/quiz#question-${answer.question_id}`);
	});

	// New question
	app.post('/admin/quiz/questions/new', async (req, res) => {
		console.log('Request to create question:', req.body);
		try {
			const question = await prisma.codamCoalitionTestQuestion.create({
				data: {
					question: req.body.question,
				},
			});
			return res.redirect(`/admin/quiz#question-${question.id}`);
		} catch (err) {
			console.error('Failed to create question:', err);
			return res.status(400).send('Failed to create question');
		}
	});

	// Edit question
	app.get('/admin/quiz/questions/:id/edit', async (req, res) => {
		console.log('Request to edit question:', req.params.id);
		// Get question
		const question = await prisma.codamCoalitionTestQuestion.findFirst({
			where: {
				id: parseInt(req.params.id),
			},
			include: {
				answers: true,
			},
		});
		if (!question) {
			return res.status(404).send('Question not found');
		}
		return res.render('admin/forms/question.njk', {
			question,
		});
	});
	app.post('/admin/quiz/questions/:id/edit', async (req, res) => {
		console.log('POST to edit question:', req.params.id);
		console.log('Body:', req.body);
		console.log('New question:', req.body.question);
		const question = await prisma.codamCoalitionTestQuestion.findFirst({
			where: {
				id: parseInt(req.params.id),
			},
		});
		if (!question) {
			return res.status(404).send('Question not found');
		}
		try {
			await prisma.codamCoalitionTestQuestion.update({
				where: {
					id: parseInt(req.params.id),
				},
				data: {
					question: req.body.question,
				},
			});
		}
		catch (err) {
			console.error('Failed to update question:', err);
		}
		return res.redirect(req.originalUrl); // return to form
	});

	// Delete question and all corresponding answers
	// Could have used DELETE method instead of POST, but HTML forms don't support DELETE method
	app.post('/admin/quiz/questions/:id/delete', async (req, res) => {
		const question = await prisma.codamCoalitionTestQuestion.findFirst({
			where: {
				id: parseInt(req.params.id),
			},
		});

		if (!question) {
			return res.status(404).send('Question not found');
		}

		await prisma.codamCoalitionTestAnswer.deleteMany({
			where: {
				question_id: parseInt(req.params.id),
			},
		});

		await prisma.codamCoalitionTestQuestion.delete({
			where: {
				id: parseInt(req.params.id),
			},
		});

		return res.redirect('/admin/quiz');
	});

	// Create answer
	app.post('/admin/quiz/answers/new', async (req, res) => {
		console.log('Request to create answer:', req.body);
		try {
			const answer = await prisma.codamCoalitionTestAnswer.create({
				data: {
					answer: req.body.answer,
					weight: parseInt(req.body.weight),
					question: {
						connect: {
							id: parseInt(req.body.question_id),
						},
					},
					coalition: {
						connect: {
							id: parseInt(req.body.coalition_id),
						},
					},
				},
			});
		}
		catch (err) {
			console.error('Failed to create answer:', err);
		}
		res.redirect(`/admin/quiz#question-${req.body.question_id}`);
	});

	// Edit answer
	app.get('/admin/quiz/answers/:id/edit', async (req, res) => {
		const answer = await prisma.codamCoalitionTestAnswer.findFirst({
			where: {
				id: parseInt(req.params.id),
			},
			include: {
				question: true,
				coalition: true,
			}
		});
		if (!answer) {
			return res.status(404).send('Answer not found');
		}

		const coalitions = await prisma.intraCoalition.findMany({
			select: {
				id: true,
				name: true,
			},
		});

		const questions = await prisma.codamCoalitionTestQuestion.findMany({
			select: {
				id: true,
				question: true,
			},
		});

		return res.render('admin/forms/answer.njk', {
			answer,
			questions,
			coalitions,
		});
	});
	app.post('/admin/quiz/answers/:id/edit', async (req, res) => {
		const answer = await prisma.codamCoalitionTestAnswer.findFirst({
			where: {
				id: parseInt(req.params.id),
			},
		});
		if (!answer) {
			return res.status(404).send('Answer not found');
		}

		try {
			await prisma.codamCoalitionTestAnswer.update({
				where: {
					id: parseInt(req.params.id),
				},
				data: {
					answer: req.body.answer,
					weight: parseInt(req.body.weight),
					question: {
						connect: {
							id: parseInt(req.body.question_id),
						},
					},
					coalition: {
						connect: {
							id: parseInt(req.body.coalition_id),
						},
					},
				},
			});
		}
		catch (err) {
			console.error('Failed to update answer:', err);
		}
		return res.redirect(req.originalUrl); // return to form
	});

	// Delete answer
	// Could have used DELETE method instead of POST, but HTML forms don't support DELETE method
	app.post('/admin/quiz/answers/:id/delete', async (req, res) => {
		const answer = await prisma.codamCoalitionTestAnswer.findFirst({
			where: {
				id: parseInt(req.params.id),
			},
		});
		if (!answer) {
			return res.status(404).send('Answer not found');
		}
		await prisma.codamCoalitionTestAnswer.delete({
			where: {
				id: parseInt(req.params.id),
			},
		});
		return res.redirect(`/admin/quiz${answer.question_id}`);
	});
};
