import { error } from '@sveltejs/kit';
import { formatEvaluationResult } from '$lib/utils';
import type { PageServerLoad } from '../../$types';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const { answer_code } = params as { answer_code: string };
	// Get the 'from' parameter to know where to go back to
	const fromPage = url.searchParams.get('from');

	if (!answer_code) {
		throw error(404, 'Código de respuesta no proporcionado');
	}

	try {
		// Get main result information
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
			.eq('code', answer_code)
			.is('section_code', null) // General result has null section_code
			.single();

		if (mainResultError) {
			console.error('Error fetching main result:', mainResultError);
			throw error(404, 'Resultado no encontrado');
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
			throw error(500, 'Error al obtener resultados por sección');
		}

		// Get student answers
		const { data: answersData, error: answersError } = await locals.supabase
			.from('eval_answers')
			.select(
				`
				question_code,
				register_code,
				student_answer,
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
			throw error(500, 'Error al obtener respuestas');
		}

		// Use the utility function to format the result
		const formattedResult = formatEvaluationResult(mainResult, sectionResults, answersData);

		// Build the response with additional navigation parameters
		return {
			result: formattedResult,
			title: `Detalle de Evaluación`,
			fromPage: fromPage || 'result', // Default to 'result' if not specified
			studentCode: mainResult.registers.student_code,
			evalCode: mainResult.eval_code,
			levelCode: mainResult.evals.level_code
		};
	} catch (err) {
		console.error('Unexpected error:', err);
		throw error(500, 'Error interno del servidor');
	}
};
