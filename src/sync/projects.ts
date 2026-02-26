import Fast42 from '@codam/fast42';
import { prisma, syncData } from './base';
import { CURSUS_ID } from '../env';

export const syncProject = async function(project: any): Promise<void> {
	try {
		await prisma.intraProject.upsert({
			where: {
				id: project.id,
			},
			update: {
				name: project.name,
				slug: project.slug,
				difficulty: project.difficulty,
				description: project.description,
				exam: project.exam,
				updated_at: new Date(project.updated_at),
			},
			create: {
				id: project.id,
				name: project.name,
				slug: project.slug,
				difficulty: project.difficulty,
				description: project.description,
				exam: project.exam,
				created_at: new Date(project.created_at),
				updated_at: new Date(project.updated_at),
			},
		});
	}
	catch (err) {
		console.error(`Error syncing project ${project.slug}: ${err}`);
	}
};

export const syncProjects = async function(api: Fast42, syncSince: Date, syncDate: Date): Promise<void> {
	console.log(`Synchronizing projects from Intra...`);

	// Fetch all projects from the API updated since the last shutdown
	const projects = await syncData(api, syncDate, syncSince, `/cursus/${CURSUS_ID}/projects`, {});

	// Insert or update each project in the database
	let i = 0;
	const total = projects.length;
	for (const project of projects) {
		console.debug(`Syncing project ${++i}/${total} (${project.slug})...`);
		await syncProject(project);
	}
};
