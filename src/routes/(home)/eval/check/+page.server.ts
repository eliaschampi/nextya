import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { OptimizedResultPayload } from '$lib/types/api';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLevels } from '$lib/data/levels';

/**
 * Empaqueta un resultado individual para el RPC de Supabase
 */
function buildRpcPayload(evalCode: string, result: OptimizedResultPayload['results'][0]) {
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
		p_eval_code: evalCode,
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
	payload: OptimizedResultPayload
): Promise<{ successCount: number; errors: string[] }> {
	const tasks = payload.results.map((r) => {
		const rpcPayload = buildRpcPayload(payload.eval_code, r);
		return supabase.rpc('upsert_eval_results', rpcPayload).then(({ error }) => {
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

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.code;
	let levels = [];

	if (userId) {
		levels = await getLevels(locals.db, userId);
	}

	return {
		levels,
		serverQuestions: [],
		title: 'Procesar OMR'
	};
};

export const actions: Actions = {
	saveResults: async ({ request, locals }) => {
		const formData = await request.formData();
		const resultsJson = formData.get('resultsToSave') as string;

		if (!resultsJson) {
			return fail(400, { message: 'No se recibieron resultados para guardar.' });
		}

		let payload: OptimizedResultPayload;
		try {
			payload = JSON.parse(resultsJson);
			if (!payload.eval_code || !Array.isArray(payload.results)) {
				throw new Error('Invalid format');
			}
		} catch {
			return fail(400, { message: 'Formato de resultados inválido.' });
		}

		if (payload.results.length === 0) {
			return fail(400, { message: 'No hay resultados válidos para guardar.' });
		}

		const { successCount, errors } = await saveAllResults(locals.db, payload);

		if (errors.length) {
			return fail(500, {
				message: `Se guardaron ${successCount} de ${payload.results.length}`,
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
