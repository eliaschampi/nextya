import type { SupabaseClient } from '@supabase/supabase-js';

export async function getCourses(supabase: SupabaseClient) {
	const { data: courses, error } = await supabase.from('courses').select('*');
	return error ? [] : courses;
}

export async function getCoursesByLevel(supabase: SupabaseClient, levelCode: string) {
	const { data: courses, error } = await supabase
		.from('courses')
		.select('*')
		.eq('level_code', levelCode);
	return error ? [] : courses;
}
