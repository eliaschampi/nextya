import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { EvaluationResult, SectionScore, StudentQuestionAnswer } from '$lib/types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { result_code } = params;

	if (!result_code) {
		return json({ error: 'Código de resultado no proporcionado' }, { status: 400 });
	}

	try {
		// Get main result information (general result without section)
		const { data: mainResult, error: mainResultError } = await locals.supabase
			.from('eval_results')
			.select(
				`
				*,
				registers!inner(
					code,
					student_code,
					roll_code,
					group_name,
					level_code,
					students!inner(
						name,
						last_name
					)
				),
				evals!inner(
					name,
					eval_date,
					level_code,
					levels(
						name
					)
				)
			`
			)
			.eq('code', result_code)
			.is('section_code', null) // General result has null section_code
			.single();

		if (mainResultError) {
			console.error('Error fetching main result:', mainResultError);
			return json({ error: 'Resultado no encontrado' }, { status: 404 });
		}

		// Get section results for this evaluation and register
		const { data: sectionResults, error: sectionResultsError } = await locals.supabase
			.from('eval_results')
			.select(
				`
				*,
				eval_sections!inner(
					code,
					course_code,
					courses(
						name
					)
				)
			`
			)
			.eq('register_code', mainResult.register_code)
			.eq('eval_code', mainResult.eval_code)
			.not('section_code', 'is', null); // Only section results

		if (sectionResultsError) {
			console.error('Error fetching section results:', sectionResultsError);
			return json({ error: 'Error al obtener resultados por sección' }, { status: 500 });
		}

		// Get student answers
		const { data: answersData, error: answersError } = await locals.supabase
			.from('eval_answers')
			.select(
				`
				*,
				eval_questions!inner(
					code,
					order_in_eval,
					correct_key,
					section_code,
					eval_sections(
						course_code,
						courses(
							name
						)
					)
				)
			`
			)
			.eq('register_code', mainResult.register_code)
			.order('question_code');

		if (answersError) {
			console.error('Error fetching answers:', answersError);
			return json({ error: 'Error al obtener respuestas' }, { status: 500 });
		}

		// Format section scores
		const formattedSectionScores: Record<string, SectionScore> = {};

		for (const section of sectionResults) {
			const sectionCode = section.section_code;
			if (!sectionCode) continue; // Skip if no section code

			const courseName = section.eval_sections?.courses?.name || 'Sin nombre';

			formattedSectionScores[sectionCode] = {
				section_code: sectionCode,
				section_name: courseName,
				correct_count: section.correct_count,
				incorrect_count: section.incorrect_count,
				blank_count: section.blank_count,
				total_questions: section.correct_count + section.incorrect_count + section.blank_count,
				score: section.score
			};
		}

		// Format answers
		const formattedAnswers: StudentQuestionAnswer[] = answersData.map((answer) => {
			// Determine if answer is blank or multiple
			const isBlank = answer.student_answer === null;
			const isMultiple = answer.student_answer === 'error_multiple';

			// Determine if answer is correct by comparing with correct key
			// Note: This should ideally be stored in the database
			const isCorrect =
				!isBlank && !isMultiple && answer.student_answer === answer.eval_questions.correct_key;

			return {
				question_code: answer.question_code,
				answer: answer.student_answer,
				student_answer: answer.student_answer,
				is_correct: isCorrect,
				is_blank: isBlank,
				is_multiple: isMultiple,
				order_in_eval: answer.eval_questions.order_in_eval,
				correct_key: answer.eval_questions.correct_key,
				section_code: answer.eval_questions.section_code,
				section_name: answer.eval_questions.eval_sections?.courses?.name || null
			};
		});

		// Build the response
		const response: EvaluationResult = {
			code: mainResult.code,
			student: {
				code: mainResult.registers.student_code,
				name: mainResult.registers.students.name,
				last_name: mainResult.registers.students.last_name
			},
			register: {
				code: mainResult.registers.code,
				roll_code: mainResult.registers.roll_code,
				group_name: mainResult.registers.group_name,
				level_code: mainResult.registers.level_code
			},
			eval: {
				code: mainResult.eval_code,
				name: mainResult.evals.name,
				date: mainResult.evals.eval_date,
				level_name: mainResult.evals.levels.name
			},
			scores: {
				general: {
					correct_count: mainResult.correct_count,
					incorrect_count: mainResult.incorrect_count,
					blank_count: mainResult.blank_count,
					total_questions:
						mainResult.correct_count + mainResult.incorrect_count + mainResult.blank_count,
					score: mainResult.score
				},
				by_section: formattedSectionScores
			},
			answers: formattedAnswers
		};

		return json(response);
	} catch (error) {
		console.error('Unexpected error:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
