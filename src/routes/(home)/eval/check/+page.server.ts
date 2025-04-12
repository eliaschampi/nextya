import type { PageServerLoad } from './$types';
import type { Level, EvalQuestion } from '../../../../app';

export const load: PageServerLoad = async ({ locals, url }) => {
	// Get levels for the dropdown
	const { data: levels } = await locals.supabase.from('levels').select('*').order('name');

	// Get eval code from URL if present (for direct access to a specific evaluation)
	const evalCode = url.searchParams.get('eval');
	let questions: EvalQuestion[] = [];

	// If eval code is provided, fetch questions for this evaluation
	if (evalCode) {
		const { data: questionsData } = await locals.supabase
			.from('eval_questions')
			.select('*')
			.eq('eval_code', evalCode)
			.order('order_in_eval');

		if (questionsData) {
			questions = questionsData;
		}
	}

	return {
		levels: levels as Level[],
		questions,
		evalCode,
		title: 'Procesar evaluacion'
	};
};
