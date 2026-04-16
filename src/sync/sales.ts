import Fast42 from '@codam/fast42';
import { prisma } from '../handlers/db';
import { CAMPUS_ID, CURSUS_ID } from '../env';
import { fetchMultiple42ApiPages } from './base';

export const syncBalance = async function(balance: any): Promise<void> {
	try {
		await prisma.intraBalance.upsert({
			where: {
				id: balance.id,
			},
			update: {
				begin_at: new Date(balance.begin_at),
				end_at: balance.end_at ? new Date(balance.end_at) : null,
				pool_id: balance.pool_id,
			},
			create: {
				id: balance.id,
				begin_at: new Date(balance.begin_at),
				end_at: balance.end_at ? new Date(balance.end_at) : null,
				pool_id: balance.pool_id,
			},
		});
	}
	catch (err) {
		console.error(`Error syncing balance ${balance.id}: ${err}`);
	}
};

const errorMultiplePools = function(poolIds: number[]): void {
	console.warn(`Multiple different pool IDs found in the database for eval point sales, this should not happen! Won't continue synchronizing balances. Found pool IDs: ${poolIds.join(', ')}`);
};

export const syncEvalPointSales = async function(api: Fast42): Promise<void> {
	console.log(`Synchronizing evaluation points sales (balances) from Intra...`);

	// Check if there are any balances in the database at all. If not, we have to figure out the pool_id using the Intra API.
	const balances = await prisma.intraBalance.groupBy({
		by: ['pool_id'],
	});
	let poolId: number | null = null;
	if (balances.length === 0) {
		console.log(`No eval point sales found in the database, fetching pool ID from Intra API...`);
		const poolReq = await api.get(`/pools`, { 'filter[campus_id]': `${CAMPUS_ID}`, 'filter[cursus_id]': `${CURSUS_ID}` });
		if (!poolReq.ok) {
			throw new Error(`Failed to fetch pools from Intra API to get pool ID for eval point sales (balances) synchronization`);
		}
		const pools = await poolReq.json();
		if (pools.length === 0) {
			console.warn(`No pools found for campus ${CAMPUS_ID} and cursus ${CURSUS_ID} in Intra API, cannot synchronize eval point sales (balances). Skipping...`);
			return;
		}
		else if (pools.length > 1) {
			return errorMultiplePools(pools.map((p: any) => p.id));
		}
		poolId = pools[0].id;
		console.log(`Found pool ID ${poolId} for eval point sales (balances) synchronization`);
	}
	else if (balances.length === 1) {
		poolId = balances[0].pool_id;
		console.log(`Found pool ID ${poolId} for eval point sales (balances) synchronization from the database`);
	}
	else {
		return errorMultiplePools(balances.map(b => b.pool_id));
	}

	const fetchedBalances = await fetchMultiple42ApiPages(api, `/pools/${poolId}/balances`); // We're always fetching all, as balances don't have an updated_at field to filter only updated ones with.
	let i = 0;
	const total = fetchedBalances.length;
	for (const fetchedBalance of fetchedBalances) {
		console.debug(`Syncing evaluation points sale (a.k.a. balance) (${++i}/${total} (${fetchedBalance.id})...`);
		await syncBalance(fetchedBalance);
	}
};
