import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchRegisterByStudentCode(supabase: SupabaseClient, studentCode: string) {
	const { data, error } = await supabase
		.from('registers')
		.select('code, student:student_code (name, lastname)')
		.eq('roll_code', studentCode)
		.order('created_at', { ascending: false })
		.limit(1);

	if (error || !data || data.length === 0) {
		return null;
	}
	return data[0];
}
