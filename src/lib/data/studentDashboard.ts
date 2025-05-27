import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentScoreEvolution, StudentCourseScore, StudentCourseEvolution } from '$lib/types';

/**
 * Fetches score evolution data for a specific student
 * @param supabase Supabase client
 * @param studentCode Student code to get score evolution for
 * @returns Array of score evolution data or null if error
 */
export async function getStudentScoreEvolution(
	supabase: SupabaseClient,
	studentCode: string
): Promise<StudentScoreEvolution[] | null> {
	try {
		const { data, error } = await supabase.rpc('get_student_score_evolution', {
			p_student_code: studentCode
		});

		if (error) throw error;

		if (!data || !Array.isArray(data)) {
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error fetching student score evolution:', error);
		return null;
	}
}

/**
 * Fetches course scores for a specific student
 * @param supabase Supabase client
 * @param studentCode Student code to get course scores for
 * @returns Array of course scores or null if error
 */
export async function getStudentCourseScores(
	supabase: SupabaseClient,
	studentCode: string
): Promise<StudentCourseScore[] | null> {
	try {
		const { data, error } = await supabase.rpc('get_student_course_scores', {
			p_student_code: studentCode
		});

		if (error) throw error;

		if (!data || !Array.isArray(data)) {
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error fetching student course scores:', error);
		return null;
	}
}

/**
 * Fetches course evolution data for a specific student
 * @param supabase Supabase client
 * @param studentCode Student code to get course evolution for
 * @returns Array of course evolution data or null if error
 */
export async function getStudentCourseEvolution(
	supabase: SupabaseClient,
	studentCode: string
): Promise<StudentCourseEvolution[] | null> {
	try {
		const { data, error } = await supabase.rpc('get_student_course_evolution', {
			p_student_code: studentCode
		});

		if (error) throw error;

		if (!data || !Array.isArray(data)) {
			return null;
		}

		return data;
	} catch (error) {
		console.error('Error fetching student course evolution:', error);
		return null;
	}
}
