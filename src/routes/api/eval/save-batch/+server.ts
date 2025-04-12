import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { EvalQuestion } from '../../../../app';

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

		// Get or use provided questions for this evaluation
		let questionsData: EvalQuestion[];

		// Use provided questions if available (to avoid redundant DB calls)
		if (questions && Array.isArray(questions) && questions.length > 0) {
			questionsData = questions;
		} else {
			// Fallback to fetching questions from database if not provided
			const { data, error } = await locals.supabase
				.from('eval_questions')
				.select('*')
				.eq('eval_code', evalCode)
				.order('order_in_eval');

			if (error || !data) {
				console.error('Error fetching questions:', error);
				return json(
					{
						status: 'error',
						message: 'Error al obtener preguntas de la evaluación'
					},
					{ status: 500 }
				);
			}

			questionsData = data;
		}

		// Process each result
		const processedResults = [];
		const errors = [];

		for (const result of results) {
			const { registerCode, answers, correctCount, incorrectCount, blankCount, totalScore } =
				result;

			if (!registerCode || !answers) {
				errors.push({
					registerCode: registerCode || 'unknown',
					message: 'Datos incompletos'
				});
				continue;
			}

			// Prepare answers for batch insert
			const answersToInsert = [];

			for (const question of questionsData) {
				const questionNumber = question.order_in_eval;
				const studentAnswer = answers[questionNumber];

				// Convert OMR answer format to database format
				let formattedStudentAnswer = null;
				if (studentAnswer && studentAnswer !== 'error_multiple') {
					formattedStudentAnswer = studentAnswer.toUpperCase();
				}

				// Add to batch insert
				answersToInsert.push({
					register_code: registerCode,
					question_code: question.code,
					student_answer: formattedStudentAnswer
				});
			}

			// Insert answers in a transaction
			const { error: insertError } = await locals.supabase.rpc('process_evaluation_results', {
				p_register_code: registerCode,
				p_eval_code: evalCode,
				p_answers: answersToInsert,
				p_correct_count: correctCount,
				p_blank_count: blankCount,
				p_incorrect_count: incorrectCount,
				p_score: totalScore
			});

			if (insertError) {
				console.error('Error inserting results:', insertError);
				errors.push({
					registerCode,
					message: 'Error al guardar resultados'
				});
			} else {
				processedResults.push({
					registerCode,
					status: 'success'
				});
			}
		}

		// Return results
		return json({
			status: 'success',
			message: `${processedResults.length} resultados guardados correctamente`,
			processedResults,
			errors
		});
	} catch (error) {
		console.error('Batch save API error:', error);
		return json(
			{
				status: 'error',
				message: error instanceof Error ? error.message : 'Error desconocido'
			},
			{ status: 500 }
		);
	}
};
