import type { SupabaseClient } from '@supabase/supabase-js';
import type { EvalQuestion, EvalSection } from '../../app'; // Ajusta la ruta si es necesario

export interface EvalQuestionWithSection extends EvalQuestion {
	section_code: string; // Añadido para facilitar cálculos
}

export interface EvalData {
	questions: EvalQuestionWithSection[];
	sections: EvalSection[]; // Incluimos secciones para nombres, etc.
}

/**
 * Obtiene las preguntas y secciones de una evaluación específica.
 * Asegura que cada pregunta tenga asociado su section_code.
 */
export async function fetchEvalData(
	supabase: SupabaseClient,
	evalCode: string
): Promise<EvalData | null> {
	const { data: questionsData, error: questionsError } = await supabase
		.from('eval_questions')
		.select('*, section:section_code ( code )') // Obtenemos el section_code anidado
		.eq('eval_code', evalCode)
		.order('order_in_eval');

	if (questionsError || !questionsData) {
		console.error('Error fetching questions:', questionsError);
		return null;
	}

	// Mapeamos para incluir section_code directamente en cada pregunta
	const questions: EvalQuestionWithSection[] = questionsData.map((q) => ({
		...q,
		section_code: q.section.code // Desanidamos section_code
	}));

	const { data: sections, error: sectionsError } = await supabase
		.from('eval_sections')
		.select('*, course:course_code(name)') // Incluimos nombre del curso
		.eq('eval_code', evalCode);

	if (sectionsError) {
		console.error('Error fetching sections:', sectionsError);
		// Podríamos decidir continuar sin nombres de sección si no es crítico
		return { questions, sections: [] };
	}

	return { questions, sections: sections || [] };
}
