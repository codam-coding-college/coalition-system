const ApiSearcherInputList = function(options) {
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

		// Data keys setup
		if (!this.options['dataKeys']) {
			throw new Error('Data keys in options are required');
		}
		if (!Array.isArray(this.options['dataKeys'])) {
			throw new Error('Data keys in options should be an array of objects');
		}
		if (this.options['dataKeys'].length === 0) {
			throw new Error('Data keys in options should contain at least one object');
		}
		this.dataKeys = [];
		for (const dataKey of this.options['dataKeys']) {
			// Check if dataKey is an object with at least the key 'key' and 'format' specified
			if (!dataKey['key']) {
				throw new Error('Each data key object should contain a key attribute to identify where in the JSON object a value is located');
			}
			if (!dataKey['format']) {
				throw new Error('Each data key object should contain a format attribute to specify how the value should be formatted. Usually "text".');
			}
			this.dataKeys.push({
				key: dataKey['key'].split('.'), // . allows for nested objects
				format: dataKey['format']
			});
		}

		// Input list setup
		this.inputList = document.querySelector(this.options['inputList']);
		this.inputListDataListId = 'datalist-' + Math.random().toString(36).substring(2);
		if (!this.inputList) {
			throw new Error('inputList element in options is required');
		}
		this.inputList.setAttribute('list', this.inputListDataListId);

		// Datalist setup
		this.dataList = document.createElement('datalist');
		this.dataList.id = this.inputListDataListId;
		this.inputList.insertAdjacentElement('afterend', this.dataList);

		if (this.options.loadImmediately != false) {
			this.search();
		}
	};

	this.clear = () => {
		// Delete all items in the datalist
		while (this.dataList.firstChild) {
			this.dataList.removeChild(this.dataList.firstChild);
		}
	};

	this.clearAndLoadResults = (results) => {
		this.clear();

		// Load results into datalist
		const options = [];
		for (const row of results.data) {
			const option = document.createElement('option');
			const optionValue = [];
			for (const dataKey of this.dataKeys) {
				const dataValue = dataKey['key'].reduce((obj, key) => obj[key], row);
				switch (dataKey['format']) {
					case 'text':
						optionValue.push(dataValue);
						break;
					case 'datetime':
						optionValue.push(new Date(dataValue).toLocaleString());
						break;
					case 'date':
						optionValue.push(new Date(dataValue).toLocaleDateString());
						break;
					case 'time':
						optionValue.push(new Date(dataValue).toLocaleTimeString());
						break;
					default:
						console.warn('Unknown data format', dataKey['format']);
						optionValue.push(dataValue);
						break;
				}
			}
			option.setAttribute('value', optionValue.join(' | '));
			options.push(option);
		}
		this.dataList.append(...options);
	};

	this.search = async (e, query = '') => {
		if (e) {
			e.preventDefault();
		}
		this.clear();
		const req = await fetch(this.concatUrlPaths(this.url, query));
		const results = await req.json();
		this.clearAndLoadResults(results);
	};

	this.init();
};
