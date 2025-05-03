import type { SupabaseClient } from '@supabase/supabase-js';
import type { CourseScore, EvalScore } from '$lib/types';

/**
 * Fetches course scores for a specific level
 * @param supabase Supabase client
 * @param levelCode Level code to get course scores for
 * @returns Array of course scores or null if error
 */
export async function getCourseScores(
	supabase: SupabaseClient,
	levelCode: string
): Promise<CourseScore[] | null> {
	try {
		const { data, error } = await supabase.rpc('get_level_course_scores', {
			p_level_code: levelCode
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
 * Fetches evaluation scores for a specific level and course
 * @param supabase Supabase client
 * @param levelCode Level code
 * @param courseCode Course code
 * @returns Array of evaluation scores or null if error
 */
export async function getEvalScores(
	supabase: SupabaseClient,
	levelCode: string,
	courseCode: string
): Promise<EvalScore[] | null> {
	try {
		// Get all evaluations for this level
		const { data: evalsData, error: evalsError } = await supabase
			.from('evals')
			.select('code, name, eval_date')
			.eq('level_code', levelCode)
			.order('eval_date', { ascending: true });

		if (evalsError) throw evalsError;

		if (!evalsData || !Array.isArray(evalsData) || evalsData.length === 0) {
			return [];
		}

		// Get all sections for this course and these evaluations
		const evalCodes = evalsData.map((e) => e.code);
		const { data: sectionsData, error: sectionsError } = await supabase
			.from('eval_sections')
			.select('code, eval_code')
			.eq('course_code', courseCode)
			.in('eval_code', evalCodes);

		if (sectionsError) throw sectionsError;

		if (!sectionsData || !Array.isArray(sectionsData) || sectionsData.length === 0) {
			// No sections found for this course in any evaluation
			return evalsData.map((evalItem) => ({
				eval_code: evalItem.code,
				eval_name: evalItem.name,
				eval_date: evalItem.eval_date,
				average_score: 0
			}));
		}

		// Create a map of eval_code to section_code for faster lookup
		const evalToSectionMap = new Map<string, string>();
		sectionsData.forEach((section) => {
			evalToSectionMap.set(section.eval_code, section.code);
		});

		// Get all results for these sections in a single query
		const sectionCodes = sectionsData.map((s) => s.code);
		const { data: resultsData, error: resultsError } = await supabase
			.from('eval_results')
			.select('section_code, eval_code, score')
			.in('section_code', sectionCodes);

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
		const evalScores = evalsData.map((evalItem) => {
			const scores = evalScoresMap.get(evalItem.code);
			const averageScore = scores ? parseFloat((scores.total / scores.count).toFixed(2)) : 0;

			return {
				eval_code: evalItem.code,
				eval_name: evalItem.name,
				eval_date: evalItem.eval_date,
				average_score: averageScore
			};
		});

		// Filter out evaluations with no data
		return evalScores.filter((item) => item.average_score > 0);
	} catch (error) {
		console.error('Error fetching evaluation scores:', error);
		return null;
	}
}
