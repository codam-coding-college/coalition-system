function reactiveButtonHandler(button, originalText, url) {
	// add spinner to button
	button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' + originalText;
	button.disabled = true;
	button.style.pointerEvents = 'none';
	button.style.cursor = 'wait';

	// remove existing reactive button classes
	button.classList.remove('reactive-btn-success');
	button.classList.remove('reactive-btn-warning');
	button.classList.remove('reactive-btn-danger');

	// remove existing tooltip if one exists on the button
	const tooltip = bootstrap.Tooltip.getInstance(button);
	if (tooltip) {
		tooltip.dispose();
	}
	button.setAttribute('data-bs-toggle', '');
	button.setAttribute('data-bs-placement', '');
	button.setAttribute('title', '');

	return new Promise((resolve, reject) => {
		fetch(url, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		})
		.then(response => response.json())
		.then(data => {
			button.disabled = false;
			button.style.pointerEvents = null;
			button.style.cursor = null;

			if (data.error) {
				console.error(`Error calling ${url}: `, data.error);

				// restore button
				button.innerText = `⚠ ${originalText}`;
				button.classList.add('reactive-btn-danger'); // add red inner color

				// add tooltip with error message
				button.setAttribute('data-bs-toggle', 'tooltip');
				button.setAttribute('data-bs-placement', 'top');
				button.setAttribute('title', `An error occurred: ${data.error}`);
				new bootstrap.Tooltip(button);

				reject(data.error);
				return;
			}

			console.log(`Result of ${url}: `, data);

			// restore button
			button.classList.add('reactive-btn-success'); // add green inner color
			button.innerText = `✓ ${originalText}`;

			resolve(data);
		})
		.catch((error) => {
			button.disabled = false;
			button.style.pointerEvents = null;
			button.style.cursor = null;

			console.error(`Error calling ${url}: `, error);

			// restore button
			button.innerText = `⚠ ${originalText}`;
			button.classList.add('reactive-btn-danger'); // add red inner color

			// add tooltip with error message
			button.setAttribute('data-bs-toggle', 'tooltip');
			button.setAttribute('data-bs-placement', 'top');
			button.setAttribute('title', `An error occurred: ${error}`);
			new bootstrap.Tooltip(button);

			reject(error);
		});
	});
}
