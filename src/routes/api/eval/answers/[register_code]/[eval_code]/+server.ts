import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { StudentAnswer } from '$lib/types/api';
import type { AnswerValue } from '$lib/omrProcessor';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { register_code, eval_code } = params;

	if (!register_code || !eval_code) {
		return json([]);
	}

	try {
		// Obtener las respuestas del estudiante
		const data = await locals.db
			.selectFrom('eval_answers')
			.innerJoin('eval_questions', 'eval_questions.code', 'eval_answers.question_code')
			.select([
				'eval_answers.question_code',
				'eval_answers.student_answer',
				'eval_questions.code as question_code_full',
				'eval_questions.eval_code',
				'eval_questions.section_code',
				'eval_questions.order_in_eval',
				'eval_questions.correct_key'
			])
			.where('eval_answers.register_code', '=', register_code)
			.where('eval_questions.eval_code', '=', eval_code)
			.execute();

		// Transformar los datos al formato esperado
		const answers: StudentAnswer[] = data.map((item) => {
			const isBlank = item.student_answer === null;
			const isMultiple = item.student_answer === 'error_multiple';
			const isCorrect = !isBlank && !isMultiple && item.student_answer === item.correct_key;

			// Validar que student_answer sea un valor válido para AnswerValue
			let studentAnswer: AnswerValue = null;
			if (item.student_answer === 'error_multiple') {
				studentAnswer = 'error_multiple';
			} else if (['A', 'B', 'C', 'D', 'E'].includes(item.student_answer as string)) {
				studentAnswer = item.student_answer as 'A' | 'B' | 'C' | 'D' | 'E';
			}

			return {
				question_code: item.question_code,
				student_answer: studentAnswer,
				order_in_eval: item.order_in_eval,
				correct_key: item.correct_key,
				score_percent: isCorrect ? 100 : 0,
				is_correct: isCorrect,
				is_blank: isBlank,
				is_multiple: isMultiple,
				section_code: item.section_code
			};
		});

		// Ordenar por número de pregunta
		answers.sort((a, b) => a.order_in_eval - b.order_in_eval);

		return json(answers);
	} catch (error) {
		console.error('Error en API de respuestas:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
