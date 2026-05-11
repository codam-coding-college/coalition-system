import { PrismaClient } from '@prisma/client';
import { Request, Response, Express } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface SSEClient {
	id: string;
	res: Response;
};

export type SSEStream = 'scores';

type SSEClientsMap = {
	[K in SSEStream]: Set<SSEClient>;
};

const sseClients: SSEClientsMap = {
	scores: new Set<SSEClient>(),
};

/**
 * Initializes a server side event stream for the given event name and Express request/response.
 * @param eventName Name of the server side event stream
 * @param req The ExpressJS request
 * @param res The ExpressJS response
 * @returns The newly generated ID of the SSE client
 */
const initSSE = function(stream: SSEStream, req: Request, res: Response): string {
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('x-Accel-Buffering', 'no'); // Disable buffering in Nginx
	res.flushHeaders();
	const clientId = uuidv4();
	sseClients[stream].add({ id: clientId, res });
	// console.debug(`Client ${clientId} connected to SSE stream ${stream}. Total clients for this stream: ${sseClients[stream].size}`);
	return clientId;
};

const closeSSE = function(stream: SSEStream, id: string, res: Response): void {
	res.end();
	if (!sseClients[stream]) {
		return;
	}
	sseClients[stream].forEach(client => {
		if (client.id === id) {
			sseClients[stream].delete(client);
		}
	});
	// console.debug(`Client ${id} disconnected from SSE stream ${stream}. Total clients for this stream: ${sseClients[stream].size}`);
};

export const triggerSSE = function(stream: SSEStream, eventName: string, data: any): void {
	const sseMessage = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
	if (!sseClients[stream]) {
		return;
	}
	sseClients[stream].forEach(client => {
		try {
			// console.debug(`Sending SSE message to client ${client.id} on stream ${stream}: ${sseMessage.trim()}`);
			client.res.write(sseMessage);
		} catch (err) {
			console.error('Error writing to SSE client:', err);
		}
	});
};

export const setupServerSideEventsRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/sse/scores', async (req, res) => {
		try {
			const clientId = initSSE('scores', req, res);

			res.on('close', () => {
				closeSSE('scores', clientId, res);
			});
		}
		catch (err) {
			console.error('Error setting up SSE connection:', err);
			res.status(500).send('Error setting up SSE connection');
		}
	});
};
