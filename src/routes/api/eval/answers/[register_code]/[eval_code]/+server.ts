import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { StudentAnswer } from '$lib/types/api';
import type { AnswerValue } from '$lib/omrProcessor';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { register_code, eval_code } = params;

	if (!register_code || !eval_code) {
		return json({ error: 'Código de registro o evaluación no proporcionado' }, { status: 400 });
	}

	try {
		// Obtener las respuestas del estudiante
		const { data, error } = await locals.supabase
			.from('eval_answers')
			.select(
				`
				code,
				question_code,
				student_answer,
				eval_questions!inner(
					code,
					eval_code,
					section_code,
					order_in_eval,
					correct_key
				)
			`
			)
			.eq('register_code', register_code)
			.eq('eval_questions.eval_code', eval_code);

		if (error) {
			console.error('Error al obtener respuestas:', error);
			return json({ error: 'Error al obtener respuestas' }, { status: 500 });
		}

		// Transformar los datos al formato esperado
		const answers: StudentAnswer[] = data.map((item) => {
			const question = item.eval_questions;
			const isBlank = item.student_answer === null;
			const isMultiple = item.student_answer === 'error_multiple';
			const isCorrect = !isBlank && !isMultiple && item.student_answer === question.correct_key;

			// Validar que student_answer sea un valor válido para AnswerValue
			let studentAnswer: AnswerValue = null;
			if (item.student_answer === 'error_multiple') {
				studentAnswer = 'error_multiple';
			} else if (['A', 'B', 'C', 'D', 'E'].includes(item.student_answer as string)) {
				studentAnswer = item.student_answer as 'A' | 'B' | 'C' | 'D' | 'E';
			}

			return {
				question_code: question.code,
				student_answer: studentAnswer,
				order_in_eval: question.order_in_eval,
				correct_key: question.correct_key,
				score_percent: isCorrect ? 100 : 0,
				is_correct: isCorrect,
				is_blank: isBlank,
				is_multiple: isMultiple,
				section_code: question.section_code
			};
		});

		// Ordenar por número de pregunta
		answers.sort((a, b) => a.order_in_eval - b.order_in_eval);

		return json(answers);
	} catch (error) {
		console.error('Error en API de respuestas:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Error desconocido' },
			{ status: 500 }
		);
	}
};
