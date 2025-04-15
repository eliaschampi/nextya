import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { EvalQuestion } from '../../../../app';

/**
 * API endpoint for saving OMR results after verification
 * This endpoint saves the verified results to the database
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	
		const {
			evalCode,
			registerCode,
			answers,
			correctCount,
			incorrectCount,
			blankCount,
			totalScore,
			questions = null
		} = await request.json();

		if (!evalCode || !registerCode || !answers) {
			return json(
				{
					status: 'error',
					message: 'Datos incompletos para guardar resultados'
				},
				{ status: 400 }
			);
		}
		console.log(correctCount, incorrectCount, blankCount, totalScore, questions, locals)
		
};
