import type { SupabaseClient } from '@supabase/supabase-js';
import type { CourseScore, EvalScore } from '$lib/types';

/**
 * Fetches course scores for a specific level
 * @param supabase Supabase client
 * @param levelCode Level code to get course scores for
 * @param groupName Group name to filter results
 * @returns Array of course scores or null if error
 */
export async function getCourseScores(
	supabase: SupabaseClient,
	levelCode: string,
	groupName: string
): Promise<CourseScore[] | null> {
	try {
		const { data, error } = await supabase.rpc('get_level_course_scores', {
			p_level_code: levelCode,
			p_group_name: groupName
		});

		if (error) throw error;

		if (!data || !Array.isArray(data)) {
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error fetching course scores:', error);
		return null;
	}
}

/**
 * Fetches evaluation scores for a specific level, course and group
 * @param supabase Supabase client
 * @param levelCode Level code
 * @param courseCode Course code
 * @param groupName Group name to filter results
 * @returns Array of evaluation scores or null if error
 */
export async function getEvalScores(
	supabase: SupabaseClient,
	levelCode: string,
	courseCode: string,
	groupName: string
): Promise<EvalScore[] | null> {
	try {
		// Get all sections for this course in this level
		const { data: sectionsData, error: sectionsError } = await supabase
			.from('eval_sections')
			.select(
				`
				code,
				eval_code,
				evals!inner (
					code,
					name,
					eval_date
				)
			`
			)
			.eq('course_code', courseCode)
			.eq('evals.level_code', levelCode)
			.order('evals.eval_date', { ascending: true });

		if (sectionsError) throw sectionsError;

		if (!sectionsData || !Array.isArray(sectionsData) || sectionsData.length === 0) {
			return [];
		}

		// Create a map to store unique evaluations by code
		const evalMap = new Map<string, { name: string; date: string }>();
		sectionsData.forEach((section) => {
			// Supabase puede devolver diferentes estructuras para relaciones anidadas
			// Definimos un tipo para la estructura esperada
			type EvalData = { code: string; name: string; eval_date: string };

			// Usamos unknown en lugar de any para mayor seguridad
			const evalDataArray = section.evals as unknown;

			// Si es un array, tomamos el primer elemento
			if (Array.isArray(evalDataArray) && evalDataArray.length > 0) {
				const evalData = evalDataArray[0] as EvalData;
				if (!evalMap.has(evalData.code)) {
					evalMap.set(evalData.code, {
						name: evalData.name,
						date: evalData.eval_date
					});
				}
			} else {
				// Si no es un array, asumimos que es un objeto directo
				const evalData = evalDataArray as EvalData;
				if (evalData && !evalMap.has(evalData.code)) {
					evalMap.set(evalData.code, {
						name: evalData.name,
						date: evalData.eval_date
					});
				}
			}
		});

		// Get section codes for query
		const sectionCodes = sectionsData.map((s) => s.code);

		// Get all results for these sections filtered by group
		const { data: resultsData, error: resultsError } = await supabase
			.from('eval_results')
			.select(
				`
				section_code,
				eval_code,
				score,
				register_code,
				registers!inner (
					group_name
				)
			`
			)
			.in('section_code', sectionCodes)
			.eq('registers.group_name', groupName);

		if (resultsError) throw resultsError;

		// Process results by evaluation
		const evalScoresMap = new Map<string, { total: number; count: number }>();

		if (resultsData && Array.isArray(resultsData) && resultsData.length > 0) {
			resultsData.forEach((result) => {
				const evalCode = result.eval_code;
				if (!evalScoresMap.has(evalCode)) {
					evalScoresMap.set(evalCode, { total: result.score, count: 1 });
				} else {
					const current = evalScoresMap.get(evalCode)!;
					evalScoresMap.set(evalCode, {
						total: current.total + result.score,
						count: current.count + 1
					});
				}
			});
		}

		// Map evaluation data with scores
		const evalScores: EvalScore[] = [];

		evalMap.forEach((evalData, evalCode) => {
			const scores = evalScoresMap.get(evalCode);
			// Only include evaluations that have scores for this group
			if (scores) {
				const averageScore = parseFloat((scores.total / scores.count).toFixed(2));
				evalScores.push({
					eval_code: evalCode,
					eval_name: evalData.name,
					eval_date: evalData.date,
					average_score: averageScore
				});
			}
		});

		// Sort by date
		return evalScores.sort((a, b) => {
			const dateA = new Date(a.eval_date).getTime();
			const dateB = new Date(b.eval_date).getTime();
			return dateA - dateB;
		});
	} catch (error) {
		console.error('Error fetching evaluation scores:', error);
		return null;
	}
}
