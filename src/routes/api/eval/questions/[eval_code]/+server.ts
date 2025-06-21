import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * API endpoint for fetching questions for a specific evaluation
 * This endpoint returns the questions for the specified evaluation
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const evalCode = params.eval_code;

		if (!evalCode) {
			return json({ error: 'Código de evaluación no proporcionado' }, { status: 400 });
		}

		// Get questions for this evaluation
		const questionsData = await locals.db
			.selectFrom('eval_questions')
			.selectAll()
			.where('eval_code', '=', evalCode)
			.orderBy('order_in_eval', 'asc')
			.execute();

		return json(questionsData);
	} catch (error) {
		console.error('Error in questions API:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
