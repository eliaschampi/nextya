import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { EvalQuestion } from '../../../../app';

/**
 * API endpoint for saving OMR results after verification
 * This endpoint saves the verified results to the database
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
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

		// Prepare answers for batch insert
		const answersToInsert = [];

		for (const question of questionsData) {
			const questionNumber = question.order_in_eval;
			const studentAnswer = answers[questionNumber];

			// Convert OMR answer format to database format
			let formattedStudentAnswer: string | null = null;
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
			return json(
				{
					status: 'error',
					message: 'Error al guardar resultados de evaluación'
				},
				{ status: 500 }
			);
		}

		// Return success
		return json({
			status: 'success',
			message: 'Resultados guardados correctamente'
		});
	} catch (error) {
		console.error('Save results API error:', error);
		return json(
			{
				status: 'error',
				message: error instanceof Error ? error.message : 'Error desconocido'
			},
			{ status: 500 }
		);
	}
};
