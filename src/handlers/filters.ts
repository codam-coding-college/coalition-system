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
		return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
};
