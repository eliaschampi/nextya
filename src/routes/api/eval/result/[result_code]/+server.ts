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

		// Use the utility function to format the result
		const response = formatEvaluationResult(mainResult, sectionResults, answersData);

		return json(response);
	} catch (error) {
		console.error('Unexpected error:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
