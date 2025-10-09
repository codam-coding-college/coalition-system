import Fast42 from '@codam/fast42';
import { prisma, syncData } from './base';
import { linkCoalitionToBloc, syncCoalition } from './coalitions';
import { CAMPUS_ID, CURSUS_ID } from '../env';
import { IntraBlocDeadline, Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';

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
			await linkCoalitionToBloc(coalition.id, bloc.id);
		}
	}
	catch (err) {
		console.error(`Error syncing bloc ${bloc.id}: ${err}`);
	}
};

export const syncBlocDeadline = async function(blocDeadline: any) {
	try {
		await prisma.intraBlocDeadline.upsert({
			where: {
				id: blocDeadline.id,
			},
			update: {
				begin_at: new Date(blocDeadline.begin_at),
				end_at: new Date(blocDeadline.end_at),
				updated_at: new Date(blocDeadline.updated_at),
				coalition_id: blocDeadline.coalition_id,
			},
			create: {
				id: blocDeadline.id,
				begin_at: new Date(blocDeadline.begin_at),
				end_at: new Date(blocDeadline.end_at),
				updated_at: new Date(blocDeadline.updated_at),
				created_at: new Date(blocDeadline.created_at),
				bloc_id: blocDeadline.bloc_id,
				coalition_id: blocDeadline.coalition_id,
			},
		});
	}
	catch (err) {
		console.error(`Error syncing bloc deadline ${blocDeadline.id}: ${err}`);
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
		console.debug(`Syncing bloc ${++i}/${total} (${bloc.id})...`);
		await syncBloc(bloc);

		// Fetch all bloc deadlines from the API updated since the last shutdown
		const blocDeadlines = await syncData(api, syncDate, syncSince, `/blocs/${bloc.id}/bloc_deadlines`, {});
		let j = 0;
		const totalDeadlines = blocDeadlines.length;
		for (const blocDeadline of blocDeadlines) {
			console.debug(`Syncing bloc ${bloc.id} deadline ${++j}/${totalDeadlines} (${blocDeadline.id})...`);
			await syncBlocDeadline(blocDeadline);
		}
	}
};
