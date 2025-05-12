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
		// Use the optimized SQL function
		const { data, error } = await supabase.rpc('get_course_eval_scores', {
			p_level_code: levelCode,
			p_course_code: courseCode,
			p_group_name: groupName
		});

		if (error) throw error;

		if (!data || !Array.isArray(data)) {
			return [];
		}

		return data;
	} catch (error) {
		console.error('Error fetching evaluation scores:', error);
		return null;
	}
}
