import fs from 'fs';

// Server shutdown handler
export const handleServerShutdown = async function(): Promise<void> {
	console.warn('Server is shutting down.');
	console.log('Saving timestamp of shutdown to ./.shutdown-timestamp...');
	// Save to current folder in .shutdown-timestamp file
	fs.writeFileSync('.shutdown-timestamp', Date.now().toString());
	console.log('Timestamp saved to ./.shutdown-timestamp');
	// Gracefully exit
	process.exit(0);
};
