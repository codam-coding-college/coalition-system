import { Express } from 'express';
import nunjucks from 'nunjucks';
import { timeAgo, timeFromNow } from '../utils';

export const setupNunjucksFilters = function(app: Express): void {
	const nunjucksEnv = nunjucks.configure('templates', {
		autoescape: true,
		express: app,
	});

	// Add formatting for floats to fixed
	nunjucksEnv.addFilter('toFixed', (num: number, digits: number) => {
		return num.toFixed(digits);
	});

	// Add formatting for numbers to thousands separator
	nunjucksEnv.addFilter('thousands', (num: number | string) => {
		return num.toString().replace(/\./, ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	});

	// Add formatting filter for seconds to hh:mm format
	nunjucksEnv.addFilter('formatSeconds', (seconds: number) => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return `${hours.toString().padStart(2, '0')}h${minutes.toString().padStart(2, '0')}`;
	});

	// Add formatting filter to format a date as "... minutes/hours/days ago"
	nunjucksEnv.addFilter('timeAgo', (date: Date | null) => {
		return timeAgo(date);
	});

	// Add formatting filter to format a date as "in ... minutes/hours/days"
	nunjucksEnv.addFilter('timeFromNow', (date: Date | null) => {
		return timeFromNow(date);
	});

	// Add formatting filter to format a date as a timestamp
	nunjucksEnv.addFilter('timestamp', (date: Date | null) => {
		if (!date) {
			return 0;
		}
		return date.getTime();
	});

	// Add formatting filter to format a date as a HTML date input value
	nunjucksEnv.addFilter('dateInput', (date: Date | null) => {
		if (!date) {
			return '';
		}
		return date.toISOString().split('T')[0];
	});

	// Add formatting filter to format a date as an ISO string
	nunjucksEnv.addFilter('datetimeISO', (date: Date | null) => {
		if (!date) {
			return '';
		}
		return date.toISOString();
	});

	// Add formatting to get a percentage based on two numbers
	nunjucksEnv.addFilter('perc', (num: number, total: number) => {
		return +((num / total) * 100).toFixed(2); // + in front changes to string to a number again
	});

	// Add formatting to get a percentage based on three numbers
	nunjucksEnv.addFilter('perc3', (value: number, min: number, max: number) => {
		return +(((value - min) / (max - min) * 100).toFixed(2)); // + in front changes to string to a number again
	});

	// Add filter to replace hex color with RGBA color
	nunjucksEnv.addFilter('rgba', (hex: string, alpha: number) => {
		if (!hex || !hex.startsWith('#')) {
			return `rgba(0, 0, 0, ${alpha})`;
		}
		const r = parseInt(hex.substring(1, 3), 16);
		const g = parseInt(hex.substring(3, 5), 16);
		const b = parseInt(hex.substring(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	});

	// Add filter to join an array of strings with a separator
	nunjucksEnv.addFilter('join', (arr: string[] | undefined | null | string, separator: string) => {
		if (typeof arr === 'string') {
			return arr;
		}
		if (!arr || typeof arr !== 'object' || !Array.isArray(arr)) {
			return '';
		}
		return arr.join(separator);
	});

	// Add filter to join an array of objects with a separator, of a specific key, or a key within a nested object
	nunjucksEnv.addFilter('keyjoin', (arr: any[] | undefined | null, key: string, separator: string) => {
		if (!arr || typeof arr !== 'object' || !Array.isArray(arr)) {
			return '';
		}
		return arr.map((obj) => {
			const keys = key.split('.');
			let value = obj;
			for (const k of keys) {
				if (value && k in value) {
					value = value[k];
				}
				else {
					value = '';
					break;
				}
			}
			return value;
		}).join(separator);
	});

	// Add filter to transform a boolean to a string
	nunjucksEnv.addFilter('bool', (value: boolean) => {
		return value ? 'true' : 'false';
	});

	// Add filter to name a season
	nunjucksEnv.addFilter('seasonName', (season: any) => {
		if (!season || !season.begin_at || !season.end_at) {
			return 'Unknown season';
		}
		// return `${season.begin_at.getFullYear()}-${season.begin_at.getMonth() + 1} > ${season.end_at.getFullYear()}-${season.end_at.getMonth() + 1}`;
		return `${season.end_at.toLocaleString('en-US', { month: 'short' })} ${season.end_at.getFullYear()}`;
	});

	// Add filter to remove the first item from a list
	nunjucksEnv.addFilter('skipFirst', (arr: any[] | undefined | null) => {
		if (!arr || typeof arr !== 'object' || !Array.isArray(arr)) {
			return [];
		}
		return arr.slice(1);
	});
};
