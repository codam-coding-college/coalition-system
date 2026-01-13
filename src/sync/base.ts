import fs from 'fs';
import { PrismaClient } from "@prisma/client";
import Fast42 from "@codam/fast42";
import { initCodamQuiz } from "./quiz";
import { initCodamCoalitionFixedTypes } from "./fixed_point_types";
import { syncUsers } from "./users";
import { syncBlocs } from "./blocs";
import { syncCoalitionUsers } from "./coalitions_users";
import { NODE_ENV, DEV_DAYS_LIMIT } from "../env";
import { cleanupDB } from "./cleanup";
import { syncProjects } from "./projects";
import { syncCursusUsers } from './cursus_users';
import { syncScores } from './scores';
import { getBlocAtDate } from '../utils';
import { handleRankingTitleCreation, handleRankingBonuses } from './rankings';
import { syncTitles } from './titles';
import { calculateResults } from './results';
import { syncGroups, syncGroupsUsers } from './groups';

export const prisma = new PrismaClient();

/**
 * Fetch all items from all pages of a Fast42 API endpoint.
 * @usage const codamStudents = await fetchMultiple42ApiPages(api, '/v2/campus/14/users');
 * @param api A Fast42 instance
 * @param path The API path to fetch
 * @param params Optional query parameters for the API request
 * @returns A promise that resolves to an array containing all items from all pages of the API responses
 */
export const fetchMultiple42ApiPages = async function(api: Fast42, path: string, params: { [key: string]: string } = {}): Promise<any[]> {
	return new Promise(async (resolve, reject) => {
		try {
			const pages = await api.getAllPages(path, params);

			let i = 0;
			const pageItems = await Promise.all(pages.map(async (page) => {
				let p = null;
				while (!p) {
					p = await page;
					if (p.status == 429) {
						console.error('Intra API rate limit exceeded, let\'s wait a bit...');
						const waitFor = parseInt(p.headers.get('Retry-After'));
						console.log(`Waiting ${waitFor} seconds...`);
						await new Promise((resolve) => setTimeout(resolve, waitFor * 1000 + Math.random() * 1000));
						p = null;
						continue;
					}
					if (!p.ok) {
						throw new Error(`Intra API error: ${p.status} ${p.statusText} on ${p.url}`);
					}
				}
				if (p.ok) {
					const data = await p.json();
					console.debug(`Fetched page ${++i} of ${pages.length} on ${path}...`);
					return data;
				}
			}));
			return resolve(pageItems.flat());
		}
		catch (err) {
			return reject(err);
		}
	});
};

/**
 * Fetch all items from all pages of a Fast42 API endpoint, with a callback function for each page fetched.
 * Useful for larger datasets that may not fit in memory.
 * @usage const codamStudents = await fetchMultiple42ApiPages(api, '/v2/campus/14/users');
 * @param api A Fast42 instance
 * @param path The API path to fetch
 * @param params Optional query parameters for the API request
 * @param callback A callback function to call for each page fetched
 * @returns A promise that resolves to an array containing all items from all pages of the API responses
 */
export const fetchMultiple42ApiPagesCallback = async function(api: Fast42, path: string, params: { [key: string]: string } = {}, callback: (data: any, xPage: number, xTotal: number) => void): Promise<void> {
	return new Promise(async (resolve, reject) => {
		try {
			const pages = await api.getAllPages(path, params);

			let i = 0;
			for (const page of pages) {
				let p = null;
				while (!p) {
					p = await page;
					if (!p) {
						console.log('Retrying page fetch...');
						await new Promise((resolve) => setTimeout(resolve, 1000));
						continue;
					}
					if (p.status == 429) {
						console.error('Intra API rate limit exceeded, let\'s wait a bit...');
						const waitFor = parseInt(p.headers.get('Retry-After'));
						console.log(`Waiting ${waitFor} seconds...`);
						await new Promise((resolve) => setTimeout(resolve, waitFor * 1000 + Math.random() * 1000));
						p = null;
						continue;
					}
					if (!p.ok) {
						throw new Error(`Intra API error: ${p.status} ${p.statusText} on ${p.url}`);
					}
				}
				if (p.ok) {
					const xPage = parseInt(p.headers.get('X-Page'));
					const xTotal = parseInt(p.headers.get('X-Total'));
					const data = await p.json();
					console.debug(`Fetched page ${++i} of ${pages.length} on ${path}...`);
					callback(data, xPage, xTotal);
				}
			}
			return resolve();
		}
		catch (err) {
			return reject(err);
		}
	});
};

/**
 * Fetch a single page of a Fast42 API endpoint.
 * @param api A Fast42 instance
 * @param path The API path to fetch
 * @param params Optional query parameters for the API request
 * @returns A promise that resolves to the JSON data from the API response
 */
export const fetchSingle42ApiPage = async function(api: Fast42, path: string, params: { [key: string]: string } = {}): Promise<any> {
	return new Promise(async (resolve, reject) => {
		try {
			retry: while (true) {
				const page = await api.get(path, params);

				if (page.status == 429) {
					console.error('Intra API rate limit exceeded, let\'s wait a bit...');
					const waitFor = parseInt(page.headers.get('Retry-After'));
					console.log(`Waiting ${waitFor} seconds...`);
					await new Promise((resolve) => setTimeout(resolve, waitFor * 1000 + Math.random() * 1000));
					continue retry;
				}
				if (page.ok) {
					const data = await page.json();
					return resolve(data);
				}
				else {
					reject(`Intra API error: ${page.status} ${page.statusText} on ${page.url}`);
					break;
				}
			}
		}
		catch (err) {
			return reject(err);
		}
	});
};

export const syncData = async function(api: Fast42, syncDate: Date, lastSyncDate: Date | undefined, path: string, params: any): Promise<any[]> {
	// In development mode we do not want to be stuck fetching too much data,
	// so we impose a limit based on the DEV_DAYS_LIMIT environment variable.
	//
	// The only case in which we do not want to do this is the users endpoint,
	// for which we always fetch all data
	if (lastSyncDate === undefined && NODE_ENV == "development" && !path.includes('/users')) {
		lastSyncDate = new Date(syncDate.getTime() - DEV_DAYS_LIMIT * 24 * 60 * 60 * 1000);
	}

	if (lastSyncDate !== undefined) {
		params['range[updated_at]'] = `${lastSyncDate.toISOString()},${syncDate.toISOString()}`;
		console.log(`Fetching data from Intra API updated on path ${path} since ${lastSyncDate.toISOString()}...`);
	}
	else {
		console.log(`Fetching all data from Intra API on path ${path}...`);
	}

	return await fetchMultiple42ApiPages(api, path, params);
};

export const syncDataCB = async function(api: Fast42, syncDate: Date, lastSyncDate: Date | undefined, path: string, params: any, callback: (data: any) => void): Promise<void> {
	// In development mode we do not want to be stuck fetching too much data,
	// so we impose a limit based on the DEV_DAYS_LIMIT environment variable.
	if (lastSyncDate === undefined && NODE_ENV == "development") {
		lastSyncDate = new Date(syncDate.getTime() - DEV_DAYS_LIMIT * 24 * 60 * 60 * 1000);
	}

	if (lastSyncDate !== undefined) {
		if (!path.includes('locations')) {
			params['range[updated_at]'] = `${lastSyncDate.toISOString()},${syncDate.toISOString()}`;
		}
		else {
			// Decrease lastSyncDate by 72 hours
			// Locations do not have the updated_at field, so we use the begin_at field instead
			lastSyncDate = new Date(lastSyncDate.getTime() - 72 * 60 * 60 * 1000);
			params['range[begin_at]'] = `${lastSyncDate.toISOString()},${syncDate.toISOString()}`;
		}
		console.log(`Fetching data from Intra API updated on path ${path} since ${lastSyncDate.toISOString()}...`);
	}
	else {
		console.log(`Fetching all data from Intra API on path ${path}...`);
	}

	await fetchMultiple42ApiPagesCallback(api, path, params, callback);
}

export const getLastSyncTimestamp = async function(): Promise<Date> {
	return new Promise((resolve, reject) => {
		fs.readFile('.sync-timestamp', 'utf8', (err, data) => {
			if (err) {
				// return reject(err);
				return resolve(new Date(0));
			}
			return resolve(new Date(parseInt(data)));
		});
	});
}

const saveSyncTimestamp = async function(timestamp: Date): Promise<void> {
	console.log('Saving timestamp of synchronization to ./.sync-timestamp...');
	// Save to current folder in .sync-timestamp file
	fs.writeFileSync('.sync-timestamp', timestamp.getTime().toString());
	console.log('Timestamp saved to ./.sync-timestamp');
}

export const syncWithIntra = async function(api: Fast42): Promise<void> {
	const now = new Date();

	console.info(`Starting Intra synchronization at ${now.toISOString()}...`);
	try {
		const lastSync = await getLastSyncTimestamp();

		await initCodamQuiz();
		await initCodamCoalitionFixedTypes();
		await syncProjects(api, lastSync, now);
		await syncUsers(api, lastSync, now);
		await syncCursusUsers(api, lastSync, now);
		await syncGroups(api, lastSync, now);
		await syncGroupsUsers(api, now);
		await syncBlocs(api, now); // also syncs coalitions
		await syncCoalitionUsers(api, lastSync, now);
		await handleRankingTitleCreation(api);
		await handleRankingBonuses();
		await syncTitles(api);
		await calculateResults(api);
		await cleanupDB(api);

		const currentBloc = await getBlocAtDate(prisma, new Date()); // Check if a season is currently ongoing (only then we can sync)
		if (NODE_ENV == 'production' && currentBloc) {
			// WARNING: Do not run this in development mode!
			// While it is possible to delete accidentally created scores using a dev script, you'd be mixing production and development data.
			// If needed still, the dev script is available at build/dev/delete_synced_intra_scores.js after building the project.
			await syncScores(api); // sync our scores to Intra
		}

		await saveSyncTimestamp(now);

		console.info(`Intra synchronization completed at ${new Date().toISOString()}.`);
	}
	catch (err) {
		console.error('Failed to synchronize with Intra:', err);
		console.log('Future synchronization attempts will start from the last successful sync timestamp, so no data should be missing.');
	}
};
