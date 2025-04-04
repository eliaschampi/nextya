import type { PageServerLoad } from './$types';
import type { Level, Eval, EvalSection, EvalQuestion } from '../../../../app';

export const load: PageServerLoad = async ({ locals }) => {
	const { data: levels } = await locals.supabase.from('levels').select('*').order('name');

	return {
		levels: levels as Level[],
		title: 'Procesar evaluacion'
	};
};

// Actions for the page
export const actions = {
	// Get evaluation details with sections and questions
	getEvalDetails: async ({ request, locals }) => {
		const formData = await request.formData();
		const evalCode = formData.get('evalCode')?.toString();

		if (!evalCode) {
			return { success: false, error: 'Código de evaluación no proporcionado' };
		}

		// Get evaluation with sections
		const { data: evalData, error: evalError } = await locals.supabase
			.from('evals')
			.select('*, eval_sections(*, courses(name))')
			.eq('code', evalCode)
			.single();

		if (evalError || !evalData) {
			console.error('Error fetching evaluation:', evalError);
			return { success: false, error: 'Error al obtener detalles de la evaluación' };
		}

		// Get questions for this evaluation
		const { data: questionsData, error: questionsError } = await locals.supabase
			.from('eval_questions')
			.select('*')
			.eq('eval_code', evalCode)
			.order('order_in_eval');

		if (questionsError || !questionsData) {
			console.error('Error fetching questions:', questionsError);
			return { success: false, error: 'Error al obtener preguntas de la evaluación' };
		}

		return {
			success: true,
			eval: evalData as Eval & { eval_sections: (EvalSection & { courses: { name: string } })[] },
			questions: questionsData as EvalQuestion[]
		};
	}
};
