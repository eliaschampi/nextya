import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Level, EvalQuestion, EvalWithSections } from '../../../../app';
import { fetchEvalData } from '$lib/data/eval';
import type { ResultToSave } from '$lib/types/api';
import type { SupabaseClient } from '@supabase/supabase-js';

async function saveSingleResultToDb(
	supabase: SupabaseClient,
	result: ResultToSave
): Promise<{ success: boolean; error?: string }> {
	if (!result.register_code) {
		return { success: false, error: `Resultado para ${result.roll_code} no tiene register_code.` };
	}

	const answersToSave = result.answers.map((a) => ({
		question_code: a.question_code,
		student_answer: a.student_answer
	}));

	const generalResultToSave = {
		correct_count: result.scores.general.correct_count,
		incorrect_count: result.scores.general.incorrect_count,
		blank_count: result.scores.general.blank_count,
		score: result.scores.general.score
	};

	const sectionResultsToSave: Record<string, unknown> = {};
	Object.entries(result.scores.by_section).forEach(([sectionCode, sectionScore]) => {
		sectionResultsToSave[sectionCode] = {
			correct_count: sectionScore.correct_count,
			incorrect_count: sectionScore.incorrect_count,
			blank_count: sectionScore.blank_count,
			score: sectionScore.score
		};
	});

	try {
		const { error: rpcError } = await supabase.rpc('upsert_eval_results', {
			p_eval_code: result.eval_code,
			p_register_code: result.register_code,
			p_answers: answersToSave,
			p_general_result: generalResultToSave,
			p_section_results: sectionResultsToSave
		});

		if (rpcError) {
			console.error('Error calling upsert_eval_results RPC:', rpcError);
			return {
				success: false,
				error: `Error DB guardando ${result.roll_code}: ${rpcError.message}`
			};
		}

		return { success: true };
	} catch (e) {
		console.error('Exception calling upsert_eval_results RPC:', e);
		return { success: false, error: `Excepción guardando ${result.roll_code}` };
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	// Obtener niveles
	const { data: levels, error: levelsError } = await locals.supabase
		.from('levels')
		.select('*')
		.order('name');
	if (levelsError) console.error('Error loading levels:', levelsError);

	const evalCode = url.searchParams.get('eval');
	let serverQuestions: EvalQuestion[] = [];
	let initialEval: EvalWithSections | null = null;

	// Si viene código de evaluación en URL, cargar sus datos
	if (evalCode) {
		// Cargar detalles de la evaluación
		const { data: evalData, error: evalError } = await locals.supabase
			.from('evals')
			.select('*, sections:eval_sections(*, course:course_code(name))') // Carga evaluación con secciones y nombre curso
			.eq('code', evalCode)
			.single(); // Espera una sola evaluación

		if (evalError || !evalData) {
			console.error('Error loading initial eval:', evalError);
		} else {
			initialEval = evalData as unknown as EvalWithSections; // Casting necesario por el select anidado
			// Cargar preguntas para la evaluación
			const evalDetails = await fetchEvalData(locals.supabase, evalCode);
			if (evalDetails) {
				serverQuestions = evalDetails.questions;
			} else {
				console.error('Error loading questions for initial eval:', evalCode);
				// Quizás mostrar un error al usuario en la página si falla la carga inicial
				initialEval = null; // No establecer evaluación inicial si las preguntas fallan
			}
		}
	}

	return {
		levels: (levels as Level[]) || [],
		serverQuestions, // Renombrado para claridad
		evalCode,
		initialEval, // Pasar la evaluación completa si se encontró
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
		} catch (error) {
			console.error('Failed to parse resultsToSave JSON:', error);
			return fail(400, { message: 'Formato de resultados inválido.' });
		}

		if (resultsToSave.length === 0) {
			return fail(400, { message: 'No hay resultados válidos para guardar.' });
		}

		let successCount = 0;
		const errors: string[] = [];

		// Procesar cada resultado individualmente
		for (const result of resultsToSave) {
			const saveOutcome = await saveSingleResultToDb(locals.supabase, result);
			if (saveOutcome.success) {
				successCount++;
			} else {
				errors.push(saveOutcome.error || `Error desconocido guardando ${result.roll_code}`);
			}
		}

		if (errors.length > 0) {
			// Devolver fallo parcial o total con detalles
			return fail(500, {
				message: `Se guardaron ${successCount} de ${resultsToSave.length} resultados. Errores: ${errors.join(', ')}`,
				savedCount: successCount,
				errors: errors
			});
		}

		// Éxito total
		return {
			success: true,
			message: `Se guardaron ${successCount} resultados correctamente.`,
			savedCount: successCount
		};
	}
};
