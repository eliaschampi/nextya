import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { formatEvaluationResult } from '$lib/utils';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { result_code } = params;

	if (!result_code) {
		return json({ error: 'Código de resultado no proporcionado' }, { status: 400 });
	}

	try {
		// Get main result information (general result without section)
		const mainResult = await locals.db
			.selectFrom('eval_results')
			.innerJoin('registers', 'registers.code', 'eval_results.register_code')
			.innerJoin('students', 'students.code', 'registers.student_code')
			.innerJoin('evals', 'evals.code', 'eval_results.eval_code')
			.innerJoin('levels', 'levels.code', 'evals.level_code')
			.select([
				'eval_results.code',
				'eval_results.register_code',
				'eval_results.eval_code',
				'eval_results.section_code',
				'eval_results.correct_count',
				'eval_results.incorrect_count',
				'eval_results.blank_count',
				'eval_results.score',
				'eval_results.calculated_at',
				'registers.code as register_code_full',
				'registers.student_code',
				'registers.roll_code',
				'registers.group_name',
				'registers.level_code',
				'students.name as student_name',
				'students.last_name as student_last_name',
				'evals.name as eval_name',
				'evals.eval_date',
				'levels.name as level_name'
			])
			.where('eval_results.code', '=', result_code)
			.where('eval_results.section_code', 'is', null) // General result has null section_code
			.executeTakeFirst();

		if (!mainResult) {
			return json({ error: 'Resultado no encontrado' }, { status: 404 });
		}

		// Get section results for this evaluation and register
		const sectionResults = await locals.db
			.selectFrom('eval_results')
			.innerJoin('eval_sections', 'eval_sections.code', 'eval_results.section_code')
			.innerJoin('courses', 'courses.code', 'eval_sections.course_code')
			.select([
				'eval_results.code',
				'eval_results.register_code',
				'eval_results.eval_code',
				'eval_results.section_code',
				'eval_results.correct_count',
				'eval_results.incorrect_count',
				'eval_results.blank_count',
				'eval_results.score',
				'eval_results.calculated_at',
				'eval_sections.code as section_code_full',
				'eval_sections.course_code',
				'courses.name as course_name'
			])
			.where('eval_results.register_code', '=', mainResult.register_code)
			.where('eval_results.eval_code', '=', mainResult.eval_code)
			.where('eval_results.section_code', 'is not', null) // Only section results
			.execute();

		// Get student answers
		const answersData = await locals.db
			.selectFrom('eval_answers')
			.innerJoin('eval_questions', 'eval_questions.code', 'eval_answers.question_code')
			.innerJoin('eval_sections', 'eval_sections.code', 'eval_questions.section_code')
			.innerJoin('courses', 'courses.code', 'eval_sections.course_code')
			.select([
				'eval_answers.question_code',
				'eval_answers.register_code',
				'eval_answers.student_answer',
				'eval_questions.code as question_code_full',
				'eval_questions.order_in_eval',
				'eval_questions.correct_key',
				'eval_questions.section_code',
				'eval_sections.course_code',
				'courses.name as course_name'
			])
			.where('eval_answers.register_code', '=', mainResult.register_code)
			.orderBy('eval_answers.question_code', 'asc')
			.execute();

		// Restructure mainResult to match the expected format for formatEvaluationResult
		const formattedMainResult = {
			code: mainResult.code,
			eval_code: mainResult.eval_code,
			correct_count: mainResult.correct_count,
			incorrect_count: mainResult.incorrect_count,
			blank_count: mainResult.blank_count,
			score: parseFloat(mainResult.score),
			registers: {
				code: mainResult.register_code_full,
				roll_code: mainResult.roll_code,
				group_name: mainResult.group_name,
				level_code: mainResult.level_code,
				student_code: mainResult.student_code,
				students: {
					name: mainResult.student_name,
					last_name: mainResult.student_last_name
				}
			},
			evals: {
				name: mainResult.eval_name,
				eval_date: mainResult.eval_date.toISOString(),
				level_code: mainResult.level_code,
				levels: {
					name: mainResult.level_name
				}
			}
		};

		// Restructure sectionResults to match expected format
		const formattedSectionResults = sectionResults.map((section) => ({
			section_code: section.section_code,
			correct_count: section.correct_count,
			incorrect_count: section.incorrect_count,
			blank_count: section.blank_count,
			score: parseFloat(section.score),
			eval_sections: {
				courses: {
					name: section.course_name
				}
			}
		}));

		// Restructure answersData to match expected format
		const formattedAnswersData = answersData.map((answer) => ({
			question_code: answer.question_code,
			student_answer: answer.student_answer,
			eval_questions: {
				order_in_eval: answer.order_in_eval,
				correct_key: answer.correct_key,
				section_code: answer.section_code,
				eval_sections: {
					courses: {
						name: answer.course_name
					}
				}
			}
		}));

		// Use the utility function to format the result
		const response = formatEvaluationResult(
			formattedMainResult,
			formattedSectionResults,
			formattedAnswersData
		);

		return json(response);
	} catch (error) {
		console.error('Unexpected error:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
