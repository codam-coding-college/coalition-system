console.log('Setting up scores SSE connection...');
const scoresEventSource = new EventSource('/sse/scores', {
	withCredentials: true
});

scoresEventSource.onopen = function() {
	console.log('Scores SSE connection opened.');
};

scoresEventSource.addEventListener('new_score', function(event) {
	const data = JSON.parse(event.data);
	console.log('New score:', data);
	createToast(`${data.user.intra_user.login} earned ${data.amount} points for ${data.coalition.intra_coalition.name}`, data.reason, new Date(data.created_at), data.coalition.intra_coalition.color); // Show a success toast with the new score message
});

scoresEventSource.onerror = function(error) {
	console.error('Error with scores SSE:', error);
};

scoresEventSource.onclose = function() {
	console.log('Scores SSE connection closed.');
};
