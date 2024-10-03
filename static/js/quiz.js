const Quiz = function(quizContainer, resultsContainer) {
	this.question = '';
	this.answers = [];
	this.progress = 0;
	this.total = 0;
	this.resultCalculatingTime = 3000; // milliseconds

	this.dom = {
		quizContainer: quizContainer,
		progressBar: quizContainer.querySelector('#quiz-progress'),
		question: quizContainer.querySelector('#quiz-question'),
		answers: quizContainer.querySelector('#quiz-answers'),
		nextButton: quizContainer.querySelector('#quiz-next'),

		resultsContainer: resultsContainer,
		joinButton: resultsContainer.querySelector('#quiz-join-coalition'),
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
	// Hide questions container
	this.dom.quizContainer.classList.add('d-none');

	const response = await fetch('/quiz/results', {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	});
	const data = await response.json();
	console.log("Quiz results:", data);

	// Show results container
	this.dom.resultsContainer.classList.remove('d-none');

	setTimeout(() => { // Timeout to make CSS animations work after display: block (and to make the user be able to react to the results appearing)
		// Show quiz results
		const totalPoints = data.coalitions.reduce((acc, coalition) => acc + coalition.score, 0);
		for (const coalition of data.coalitions) {
			const coalitionFitPercentage = Math.round((coalition.score / totalPoints) * 100);
			const coalitionResultLabel = this.dom.resultsContainer.querySelector(`#coalition-id-${coalition.id}`);
			coalitionResultLabel.classList.add('calculating');
			if (!coalitionResultLabel) {
				console.error(`No result label found for coalition ${coalition.id}`);
				continue;
			}
			const coalitionScoreText = coalitionResultLabel.querySelector('.quiz-result-coalition-score-percentage');

			// set text to reach the number in steps over 3 seconds
			// TODO: add ease-out effect?
			const steps = 100; // because a percentage is easily divided by 100
			const stepDuration = this.resultCalculatingTime / steps;
			const stepValue = coalitionFitPercentage / steps;
			let currentPercentage = 0;
			const interval = setInterval(() => {
				currentPercentage += stepValue;
				coalitionScoreText.textContent = currentPercentage.toFixed(0);
				if (currentPercentage >= coalitionFitPercentage) {
					clearInterval(interval);
				}
			}, stepDuration);
			// coalitionScoreText.textContent = coalitionFitPercentage.toFixed(0);

			const coalitionScoreBG = coalitionResultLabel.querySelector('.quiz-result-coalition-score-bg');
			coalitionScoreBG.style.height = `${coalitionFitPercentage}%`;
		}

		// After 3 seconds + some extra time to react, select the best fit coalition
		setTimeout(() => {
			// remove calculating class
			const calculatingCoalitions = this.dom.resultsContainer.querySelectorAll('.calculating');
			for (const coalition of calculatingCoalitions) {
				coalition.classList.remove('calculating');
				// Enable radio button
				coalition.querySelector('input[type=radio]').disabled = false;
			}

			const bestFitRadioInput = this.dom.resultsContainer.querySelector(`#coalition-radio-${data.best_fit.id}`);
			bestFitRadioInput.checked = true;

			this.dom.joinButton.disabled = false;
		}, this.resultCalculatingTime + 500);
	}, 600);
};

Quiz.prototype.update_quiz = function() {
	// Update progress bar
	this.dom.progressBar.setAttribute('aria-valuemax', this.total);
	this.dom.progressBar.setAttribute('aria-valuenow', this.progress);
	this.dom.progressBar.firstElementChild.style.width = `${(this.progress / this.total) * 100}%`;

	// Disable next button until an answer is selected
	this.dom.nextButton.disabled = true;

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
		li.classList.add('quiz-answer', 'list-group-item', 'list-group-item-action');

		const input = document.createElement('input');
		input.classList.add('form-check-input', 'me-3');
		input.type = 'radio';
		input.name = 'answer';
		input.value = answer.id;
		input.id = `answer-${answer.id}`;
		input.required = true;
		input.addEventListener('change', () => this.dom.nextButton.disabled = false); // Enable next button when an answer is selected
		li.appendChild(input);

		const label = document.createElement('label');
		label.classList.add('form-check-label', 'stretched-link');
		label.textContent = answer.answer;
		label.htmlFor = `answer-${answer.id}`;
		li.appendChild(label);

		this.dom.answers.appendChild(li);
	}
};

const quiz = new Quiz(document.getElementById('quiz'), document.getElementById('results'));

/*
return res.status(200).send({
	question,
	answers,
	progress: userSession.quiz.questionsAnswered?.length,
	total: questionCount,
});
*/
