const ApiSearcherTable = function(options) {
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

		// Page navigation setup
		if (this.options['pageNav']) {
			this.pageNav = document.querySelector(this.options['pageNav']);
		}
		else {
			this.pageNav = null;
		}

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

	this.setupPagination = (results) => {
		const pageNav = [];
		const currentPageNum = results.meta.pagination.page;
		const totalPages = results.meta.pagination.pages;
		const maxPages = 5;
		const halfMaxPages = Math.floor(maxPages / 2);
		let startPage = Math.max(1, currentPageNum - halfMaxPages);
		let endPage = Math.min(totalPages, startPage + maxPages - 1);

		if (endPage - startPage < maxPages - 1) {
			startPage = Math.max(1, endPage - maxPages + 1);
		}
		if (endPage - startPage < maxPages - 1) {
			endPage = Math.min(totalPages, startPage + maxPages - 1);
		}
		if (endPage - startPage < maxPages - 1) {
			startPage = Math.max(1, endPage - maxPages + 1);
		}
		if (startPage > 1) {
			pageNav.push({
				num: 1,
				active: false,
				text: 'First',
			});
			pageNav.push({
				num: currentPageNum - 1,
				active: false,
				text: '<',
			});
		}
		for (let i = startPage; i <= endPage; i++) {
			pageNav.push({
				num: i,
				active: i === currentPageNum,
				text: i.toString(),
			});
		}
		if (endPage < totalPages) {
			pageNav.push({
				num: currentPageNum + 1,
				active: false,
				text: '>',
			});
			pageNav.push({
				num: totalPages,
				active: false,
				text: 'Last',
			});
		}

		const ul = document.createElement('ul');
		ul.classList.add('pagination');
		for (const page of pageNav) {
			const li = document.createElement('li');
			li.classList.add('page-item');
			if (page.active) {
				li.classList.add('active');
				li.setAttribute('aria-current', 'page');
			}
			const a = document.createElement('a');
			a.classList.add('page-link');
			a.innerText = page.text;
			a.href = '?page=' + page.num;
			a.addEventListener('click', (e) => {
				e.preventDefault();
				this.clearAndShowLoading();
				this.search(null, e.target.href.split('=')[1]);
				// TODO: update page URL
			});
			li.appendChild(a);
			ul.appendChild(li);
		}
		this.pageNav.appendChild(ul);
	};

	this.clear = () => {
		// Delete all tbody children
		const tbody = this.results.querySelector('tbody');
		while (tbody.firstChild) {
			tbody.removeChild(tbody.firstChild);
		}

		// Clear pagination
		if (this.pageNav) {
			while (this.pageNav.firstChild) {
				this.pageNav.removeChild(this.pageNav.firstChild);
			}
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

	this.clearAndLoadResults = (results) => {
		this.clear();
		const tbody = this.results.querySelector('tbody');

		// Set up pagination
		if (this.pageNav) {
			this.setupPagination(results);
		}

		// Load results into table
		const trs = [];
		for (const row of results.data) {
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
						case 'date': {
							td.innerText = new Date(value).toLocaleDateString();
							break;
						}
						case 'time': {
							td.innerText = new Date(value).toLocaleTimeString();
							break;
						}
						case 'code': {
							const code = document.createElement('code');
							code.innerText = value;
							td.appendChild(code);
							break;
						}
						case 'login': {
							const a = document.createElement('a');
							a.href = '/profile/' + value;
							a.innerText = value;
							td.appendChild(a);
							break;
						}
						case 'logins': {
							const splitLogins = value.split(',');
							for (let i = 0; i < splitLogins.length; i++) {
								const login = splitLogins[i].trim();
								const a = document.createElement('a');
								a.href = '/profile/' + login;
								a.innerText = login;
								td.appendChild(a);
								if (i < splitLogins.length - 1) {
									td.appendChild(document.createTextNode(', '));
								}
							}
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

	this.abortController = null;
	this.search = async (e, pageNum = 1) => {
		if (e) {
			e.preventDefault();
		}
		// Abort any ongoing fetch requests
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
		// Check if a filter should be applied
		let filter = '';
		if (this.filterSelector.value != 'none' && this.filterValue.value != '') {
			filter = this.filterSelector.value + '/' + this.filterValue.value;
			// TODO: update page URL with filter
		}
		this.clearAndShowLoading();
		try {
			this.abortController = new AbortController();
			fetch(this.concatUrlPaths(this.url, filter) + '?page=' + pageNum, { signal: this.abortController.signal })
				.then(req => req.json())
				.then(results => this.clearAndLoadResults(results))
		}
		catch (err) {
			if (err.name === 'AbortError') {
				console.log('Search aborted');
			}
			else {
				console.error('An error occurred while fetching data', err);
			}
		}
	};

	this.init();
};
