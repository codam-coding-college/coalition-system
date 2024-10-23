// Automatically load charts on the page
window.addEventListener('DOMContentLoaded', async function() {
	console.log('DOM fully loaded and parsed, loading charts...');
	const charts = document.querySelectorAll('.codam-chart');
	charts.forEach(async function(chart) {
		const dataUrl = chart.getAttribute('data-url');
		if (!dataUrl) {
			console.error('No data-url attribute found on chart element', chart);
			return;
		}
		try {
			const fetcher = await fetch(dataUrl);
			const data = await fetcher.json();
			new Chart(chart, data); // Using Chart.js
		}
		catch (err) {
			console.error('Error loading chart', err);
		}
	});
});
