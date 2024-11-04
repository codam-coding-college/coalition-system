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
			if (!fetcher.ok) {
				throw new Error(`Failed to load data from ${dataUrl}`);
			}
			const data = await fetcher.json();
			// Always resize charts
			data.options = data.options || {};
			data.options.responsive = true;
			data.options.maintainAspectRatio = false;
			new Chart(chart, data); // Using Chart.js
		}
		catch (err) {
			console.error('Error loading chart', err);
		}
	});
});
