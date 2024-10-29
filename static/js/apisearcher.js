const ApiSearcher = function(options) {
	this.options = options;

	this.concatUrlPaths = (url, path) => {
		if (url[url.length - 1] === '/') {
			url = url.slice(0, -1);
		}
		if (path[0] === '/') {
			path = path.slice(1);
		}
		return url + '/' + path;
	};

	this.init = () => {
		// URL setup
		if (!this.options['url']) {
			throw new Error('URL in options is required');
		}
		this.url = this.options['url'];

		// Table elements setup
		if (!this.options['results']) {
			throw new Error('Results table element in options is required');
		}
		this.results = document.querySelector(this.options['results']);
		// Check if a tbody element exists
		if (!this.results.querySelector('tbody')) {
			const tbody = document.createElement('tbody');
			this.results.appendChild(tbody);
		}
		// Parse headers from thead
		this.headers = [];
		const thead = this.results.querySelector('thead');
		if (!thead) {
			throw new Error('Table headers are required in a thead element');
		}
		if (!thead.querySelector('tr')) {
			throw new Error('Table headers should be in a tr element');
		}
		const ths = thead.querySelectorAll('th');
		for (const th of ths) {
			const dataKey = th.getAttribute('data-key');
			if (!dataKey) {
				throw new Error('Each th element should contain a data-key attribute to identify where in the JSON object a value is located');
			}
			const dataFormat = th.getAttribute('data-format') || 'text';
			this.headers.push({
				headerElement: th,
				dataKey: dataKey.split('.'), // . allows for nested objects
				dataFormat
			});
		}

		// Add potential points column to table headers
		if (this.options['noPoints'] !== true) {
			const thPoints = document.createElement('th');
			thPoints.setAttribute('scope', 'col');
			thPoints.innerText = 'Potential points';
			thead.querySelector("tr").appendChild(thPoints);
		}

		// Add actions column to table headers
		const thActions = document.createElement('th');
		thActions.setAttribute('scope', 'col');
		thActions.classList.add('text-end');
		thActions.style.textAlign = 'end';
		thActions.innerText = 'Actions';
		thead.querySelector("tr").appendChild(thActions);

		// Filter elements setup
		if (!this.options['filterSelector']) {
			throw new Error('Filter selector in options is required');
		}
		this.filterSelector = document.querySelector(this.options['filterSelector']);
		if (!this.options['filterValue']) {
			throw new Error('Filter value input in options is required');
		}
		this.filterValue = document.querySelector(this.options['filterValue']);
		if (!this.options['filterForm']) {
			throw new Error('Filter form in options is required');
		}
		this.filterForm = document.querySelector(this.options['filterForm']);
		this.filterForm.addEventListener('submit', this.search);

		// Points calculator setup
		if (this.options['noPoints'] !== true) {
			if (!this.options['pointsCalculator']) {
				throw new Error('Points calculator in options is required if noPoints is not set to true');
			}
			if (!(typeof this.options['pointsCalculator'] === 'function')) {
				throw new Error('Points calculator must be a function');
			}
			this.pointsCalculator = this.options['pointsCalculator'];
		}
		else {
			this.pointsCalculator = () => 0;
		}

		// Actions setup
		if (!this.options['actions']) {
			throw new Error('Actions in options is required');
		}
		this.actions = [];
		for (let action of this.options['actions']) {
			const actionClone = Object.assign({}, action);
			if (!action['name']) {
				throw new Error('Action name is required');
			}
			if (!action['url']) {
				throw new Error('Action URL is required');
			}
			if (!action['background']) {
				actionClone['background'] = false;
			}
			this.actions.push(actionClone);
		}

		if (this.options.loadImmediately != false) {
			this.search();
		}
	};

	this.clear = () => {
		// Delete all tbody children
		const tbody = this.results.querySelector('tbody');
		while (tbody.firstChild) {
			tbody.removeChild(tbody.firstChild);
		}
	};

	this.clearAndShowLoading = () => {
		this.clear();
		const tbody = this.results.querySelector('tbody');

		// Create placeholder rows
		const placeholderAmount = 10;
		for (let i = 0; i < placeholderAmount; i++) {
			const tr = document.createElement('tr');
			for (let j = 0; j < this.headers.length + 2; j++) {
				const td = document.createElement('td');
				td.classList.add('placeholder-glow');
				tr.appendChild(td);

				const placeholderSpan = document.createElement('span');
				placeholderSpan.classList.add('placeholder', 'col-8');
				td.appendChild(placeholderSpan);
			}
			tbody.appendChild(tr);
		}
	};

	this.clearAndLoadResults = (data) => {
		this.clear();
		const tbody = this.results.querySelector('tbody');

		// Load results into table
		const trs = [];
		for (const row of data) {
			const tr = document.createElement('tr');
			for (const header of this.headers) {
				const td = document.createElement('td');
				try {
					const value = header.dataKey.reduce((obj, key) => obj[key], row);
					switch (header.dataFormat) {
						case 'text': {
							td.innerText = value;
							break;
						}
						case 'datetime': {
							td.innerText = new Date(value).toLocaleString();
							break;
						}
						case 'code': {
							const code = document.createElement('code');
							code.innerText = value;
							td.appendChild(code);
							break;
						}
						case 'json': {
							try {
								renderjson.set_show_to_level(2);
								renderjson.set_max_string_length(64);
								td.appendChild(renderjson(JSON.parse(value)));
							}
							catch (err) {
								console.error('An error occurred while parsing JSON', row, err);
								td.innerText = '⚠ JSON PARSING ERROR';
								td.classList.add('text-danger');
							}
							break;
						}
						case 'image': {
							if (!value) {
								td.innerText = 'No image';
								td.classList.add('text-muted');
							}
							else {
								const img = document.createElement('img');
								img.src = value;
								img.alt = "Image failed to load";
								img.style.maxWidth = '100px';
								img.style.maxHeight = '100px';
								img.setAttribute('loading', 'lazy');
								td.appendChild(img);
							}
							break;
						}
						default: {
							console.warn('Unknown data format', header.dataFormat);
							td.innerText = value;
							break;
						}
					}
				}
				catch (err) {
					console.error(`An error occurred while parsing data (${header.dataKey})`, row, err);
					td.innerText = '⚠ PARSING ERROR';
					td.classList.add('text-danger');
				}
				tr.appendChild(td);
			}

			// Calculate points
			if (this.options['noPoints'] !== true) {
				const points = this.pointsCalculator(row);
				const tdPoints = document.createElement('td');
				tdPoints.innerText = points;
				tr.appendChild(tdPoints);
			}

			// Add actions
			const tdActions = document.createElement('td');
			tdActions.classList.add('text-end');
			tdActions.style.textAlign = 'end';
			for (const action of this.actions) {
				if (action['background'] !== false) {
					const button = document.createElement('button');
					button.classList.add('btn', 'btn-sm', 'btn-outline-secondary');
					button.innerText = action.name;
					button.addEventListener('click', async () => {
						button.disabled = true;
						await reactiveButtonHandler(button, action.name, this.concatUrlPaths(action.url, row.id));
						button.disabled = false;
					});
					tdActions.appendChild(button);
				}
				else {
					const button = document.createElement('a');
					button.classList.add('btn', 'btn-sm', 'btn-outline-secondary');
					button.innerText = action.name;
					button.href = this.concatUrlPaths(action.url, row.id);
					button.target = '_self';
					tdActions.appendChild(button);
				}
			}
			tr.appendChild(tdActions);

			trs.push(tr);
		}
		tbody.append(...trs);
	};

	this.search = async (e) => {
		if (e) {
			e.preventDefault();
		}
		// Check if a filter should be applied
		let filter = '';
		if (this.filterSelector.value != 'none' && this.filterValue.value != '') {
			filter = this.filterSelector.value + '/' + this.filterValue.value;
		}
		this.clearAndShowLoading();
		const req = await fetch(this.concatUrlPaths(this.url, filter));
		const results = await req.json();
		this.clearAndLoadResults(results);
	};

	this.init();
};
