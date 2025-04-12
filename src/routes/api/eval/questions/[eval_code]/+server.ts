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
			return json(
				{
					status: 'error',
					message: 'Código de evaluación no proporcionado'
				},
				{ status: 400 }
			);
		}

		// Get questions for this evaluation
		const { data: questionsData, error: questionsError } = await locals.supabase
			.from('eval_questions')
			.select('*')
			.eq('eval_code', evalCode)
			.order('order_in_eval');

		if (questionsError) {
			console.error('Error fetching questions:', questionsError);
			return json(
				{
					status: 'error',
					message: 'Error al obtener preguntas de la evaluación'
				},
				{ status: 500 }
			);
		}

		return json(questionsData || []);
	} catch (error) {
		console.error('Error in questions API:', error);
		return json(
			{
				status: 'error',
				message: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};
