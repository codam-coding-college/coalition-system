console.log('Setting up scores SSE connection...');
const scoresEventSource = new EventSource('/sse/scores', {
	withCredentials: true
});

scoresEventSource.onopen = function() {
	console.log('Scores SSE connection opened.');
};

scoresEventSource.addEventListener('ping', function(event) {
	console.log('Received ping from scores SSE.');
});

scoresEventSource.addEventListener('new_score', function(event) {
	const data = JSON.parse(event.data);
	console.log('New score:', data);
	if (data.amount > 0) {
		createToast(`+ Points earned for ${data.coalition.intra_coalition.name}`, `${data.user.intra_user.login} earned ${data.amount} points for ${data.coalition.intra_coalition.name}\n${data.reason}`, new Date(data.created_at), data.coalition.intra_coalition.color);
	}
	else {
		createToast(`- Points deducted for ${data.coalition.intra_coalition.name}`, `${data.user.intra_user.login} lost ${-data.amount} points for ${data.coalition.intra_coalition.name}\n${data.reason}`, new Date(data.created_at), data.coalition.intra_coalition.color);
	}
});

scoresEventSource.onerror = function(error) {
	console.error('Error with scores SSE:', error);
};

scoresEventSource.onclose = function() {
	console.log('Scores SSE connection closed.');
};
