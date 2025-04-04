import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processOmrImage } from '$lib/omrProcessor';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { imageData, params } = await request.json();

		if (!imageData || !params) {
			return json(
				{
					status: 'error',
					message: 'Missing required fields: imageData or params'
				},
				{ status: 400 }
			);
		}

		const result = await processOmrImage(imageData, params, true);
		return json(result);
	} catch (error) {
		console.error('OMR API error:', error);
		return json(
			{
				status: 'error',
				message: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};
