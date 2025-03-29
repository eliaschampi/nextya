import type { SupabaseClient } from '@supabase/supabase-js';

export async function getCourses(supabase: SupabaseClient) {
	const { data: courses, error } = await supabase.from('courses').select('*');
	return error ? [] : courses;
}
