const Quiz = function(quizContainer) {
	this.question = '';
	this.answers = [];
	this.progress = 0;
	this.total = 0;

	this.dom = {
		progressBar: quizContainer.querySelector('#quiz-progress'),
		question: quizContainer.querySelector('#quiz-question'),
		answers: quizContainer.querySelector('#quiz-answers'),
		nextButton: quizContainer.querySelector('#quiz-next'),
	};

	this.dom.nextButton.addEventListener('click', this.post_next.bind(this));

	try {
		this.next_question();
	}
	catch (err) {
		console.error(`Failed to load initial question: ${err}`);
	}
};

Quiz.prototype.post_next = async function() {
	try {
		const answerOk = await this.post_answer();
		if (answerOk) {
			// Load next question (or results if quiz is finished)
			await this.next_question();
		}
		else {
			console.error('Failed to post answer, check Network dev tools tab for details');
		}
	}
	catch (err) {
		console.error(`Failed to post answer: ${err}`);
		alert('Failed to post answer, please try again');
	}
};

Quiz.prototype.next_question = async function() {
	const response = await fetch('/quiz/question', {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	});
	const data = await response.json();
	this.question = data.question;
	this.answers = data.answers;
	this.progress = data.progress;
	this.total = data.total;
	if (this.progress === this.total) {
		this.results();
	}
	this.update_quiz();
};

Quiz.prototype.post_answer = async function() {
	const answer = this.dom.answers.querySelector('input[name="answer"]:checked');
	if (!answer) {
		console.warn('No answer selected');
		alert('Please select an answer');
		return false;
	}

	this.dom.nextButton.disabled = true;

	const response = await fetch('/quiz/answer', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			answer_id: parseInt(answer.value),
		}),
	});
	await response.text();
	return response.status === 204;
};

Quiz.prototype.results = async function() {
	const response = await fetch('/quiz/results', {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	});
	const data = await response.json();
	console.log("Quiz results:", data);
	alert(`According to our quiz, you belong to the ${data.coalition.name} coalition!`);
};

Quiz.prototype.update_quiz = function() {
	// Update progress bar
	this.dom.progressBar.max = this.total;
	this.dom.progressBar.value = this.progress;

	// Remove old question and answers
	while (this.dom.answers.firstChild) {
		this.dom.answers.removeChild(this.dom.answers.firstChild);
	}
	if (this.progress === this.total) {
		this.dom.question.textContent = '';
		return;
	}

	// Populate new question and answers
	this.dom.question.textContent = this.question.question;
	for (const answer of this.answers) {
		const li = document.createElement('li');

		const input = document.createElement('input');
		input.type = 'radio';
		input.name = 'answer';
		input.value = answer.id;
		input.id = answer.id;
		input.addEventListener('change', () => this.dom.nextButton.disabled = false); // Enable next button when an answer is selected
		li.appendChild(input);

		const label = document.createElement('label');
		label.textContent = answer.answer;
		label.htmlFor = answer.id;
		li.appendChild(label);

		this.dom.answers.appendChild(li);
	}

	// Disable next button until an answer is selected
	this.dom.nextButton.disabled = true;
};

const quiz = new Quiz(document.getElementById('quiz'));

/*
return res.status(200).send({
	question,
	answers,
	progress: userSession.quiz.questionsAnswered?.length,
	total: questionCount,
});
*/
