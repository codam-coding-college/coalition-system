import Fast42 from '@codam/fast42';
import { prisma, syncData } from './base';
import { syncCoalition } from './coalitions';
import { CAMPUS_ID, CURSUS_ID } from '../env';

// Bloc object can be an object returned by /v2/bloc/:id !
export const syncBloc = async function(bloc: any): Promise<void> {
	try {
		await prisma.intraBloc.upsert({
			where: {
				id: bloc.id,
			},
			update: {
				cursus_id: bloc.cursus_id,
				squad_size: bloc.squad_size,
				created_at: new Date(bloc.created_at),
				updated_at: new Date(bloc.updated_at),
			},
			create: {
				id: bloc.id,
				cursus_id: bloc.cursus_id,
				squad_size: bloc.squad_size,
				created_at: new Date(bloc.created_at),
				updated_at: new Date(bloc.updated_at),
			},
		});

		// Sync the bloc's coalitions
		for (const coalition of bloc.coalitions) {
			await syncCoalition(coalition);
		}
	}
	catch (err) {
		console.error(`Error syncing bloc ${bloc.name}: ${err}`);
	}
};

export const syncBlocs = async function(api: Fast42, syncDate: Date): Promise<void> {
	// Always sync all blocs
	const syncSince = new Date(0);

	// Fetch all blocs from the API updated since the last shutdown
	const blocs = await syncData(api, syncDate, syncSince, `/blocs`, {
		'filter[campus_id]': CAMPUS_ID.toString(),
		'filter[cursus_id]': CURSUS_ID.toString(),
	});

	// Insert or update each bloc in the database
	let i = 0;
	const total = blocs.length;
	for (const bloc of blocs) {
		console.debug(`Syncing bloc ${++i}/${total} (${bloc.name})...`);
		await syncBloc(bloc);
	}
};
