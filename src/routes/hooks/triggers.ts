// Webhook triggers for the admin panel
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import Fast42 from '@codam/fast42';
import { CAMPUS_ID, CURSUS_ID } from '../../env';
import { getAPIClient, fetchSingleApiPage } from '../../utils';
import { handleLocationCloseWebhook, Location } from './locations';

const createTriggerDeliveryId = function(): string {
	return `internal-trigger-${uuidv4()}`;
};

export const setupWebhookTriggerRoutes = function(app: Express, prisma: PrismaClient): void {
	app.get('/admin/points/trigger/logtime/id/:id', async (req, res) => {
		// ID belongs to a location ID in the intra system
		const api = await getAPIClient();
		const location: Location = await fetchSingleApiPage(api, `/locations/${req.params.id}`, {});
		if (location === null) {
			return res.status(404).json({ error: 'Location not found' });
		}
		// Make a request to the webhooks endpoint
		await handleLocationCloseWebhook(prisma, {
			modelType: 'location',
			eventType: 'close',
			deliveryId: createTriggerDeliveryId(),
		}, location, null);
		return res.status(200).json({ status: 'ok' });
	});
};
