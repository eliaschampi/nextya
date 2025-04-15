import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * API endpoint for saving multiple OMR results in batch
 * This endpoint saves multiple verified results to the database
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { evalCode, results, questions = null } = await request.json();

		if (!evalCode || !results || !Array.isArray(results) || results.length === 0) {
			return json(
				{
					status: 'error',
					message: 'Datos incompletos para guardar resultados en lote'
				},
				{ status: 400 }
			);
		}
		console.log(questions, locals);
		
};
