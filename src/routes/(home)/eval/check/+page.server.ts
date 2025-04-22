import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { EvalQuestion, EvalWithSections } from '$lib/types';
import type { ResultToSave } from '$lib/types/api';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchQuestions } from '$lib/data/question';
import { getLevels } from '$lib/data/levels';

/**
 * Empaqueta un resultado para el RPC de Supabase
 */
function buildRpcPayload(result: ResultToSave) {
	const answers = result.answers.map((a) => ({
		question_code: a.question_code,
		student_answer: a.student_answer
	}));

	const general = {
		correct_count: result.scores.general.correct_count,
		incorrect_count: result.scores.general.incorrect_count,
		blank_count: result.scores.general.blank_count,
		score: result.scores.general.score
	};

	const by_section: Record<string, unknown> = {};
	for (const [sectionCode, s] of Object.entries(result.scores.by_section)) {
		by_section[sectionCode] = {
			correct_count: s.correct_count,
			incorrect_count: s.incorrect_count,
			blank_count: s.blank_count,
			score: s.score
		};
	}

	return {
		p_eval_code: result.eval_code,
		p_register_code: result.register_code,
		p_answers: answers,
		p_general_result: general,
		p_section_results: by_section
	};
}

/**
 * Guarda todos los resultados en paralelo usando Promise.allSettled
 */
async function saveAllResults(
	supabase: SupabaseClient,
	results: ResultToSave[]
): Promise<{ successCount: number; errors: string[] }> {
	const tasks = results.map((r) => {
		const payload = buildRpcPayload(r);
		return supabase.rpc('upsert_eval_results', payload).then(({ error }) => {
			if (error) throw new Error(`${r.roll_code}: ${error.message}`);
		});
	});

	const settled = await Promise.allSettled(tasks);
	let successCount = 0;
	const errors: string[] = [];

	for (const res of settled) {
		if (res.status === 'fulfilled') {
			successCount++;
		} else {
			errors.push(res.reason.message || 'Error desconocido');
		}
	}

	return { successCount, errors };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const evalCode = url.searchParams.get('eval');
	const userId = locals.session?.user.id;
	let levels = [];
	let initialEval: EvalWithSections | null = null;
	let serverQuestions: EvalQuestion[] = [];
	if (userId) {
		levels = await getLevels(locals.supabase, userId);
	}

	if (evalCode) {
		const { data, error } = await locals.supabase
			.from('evals')
			.select('*, sections:eval_sections(*, course:course_code(name))')
			.eq('code', evalCode)
			.single();

		if (error) {
			console.error('Error loading initial eval:', error);
		} else if (data) {
			initialEval = data as unknown as EvalWithSections;
			serverQuestions = await fetchQuestions(evalCode, locals.supabase);
		}
	}

	return {
		levels,
		evalCode,
		initialEval,
		serverQuestions,
		title: 'Procesar Evaluación OMR'
	};
};

export const actions: Actions = {
	saveResults: async ({ request, locals }) => {
		const formData = await request.formData();
		const resultsJson = formData.get('resultsToSave') as string;

		if (!resultsJson) {
			return fail(400, { message: 'No se recibieron resultados para guardar.' });
		}

		let resultsToSave: ResultToSave[];
		try {
			resultsToSave = JSON.parse(resultsJson);
			if (!Array.isArray(resultsToSave)) throw new Error('Invalid format');
		} catch {
			return fail(400, { message: 'Formato de resultados inválido.' });
		}

		if (resultsToSave.length === 0) {
			return fail(400, { message: 'No hay resultados válidos para guardar.' });
		}

		const { successCount, errors } = await saveAllResults(locals.supabase, resultsToSave);

		if (errors.length) {
			return fail(500, {
				message: `Se guardaron ${successCount} de ${resultsToSave.length}`,
				savedCount: successCount,
				errors
			});
		}

		return {
			success: true,
			message: `Se guardaron ${successCount} resultados correctamente.`,
			savedCount: successCount
		};
	}
};
