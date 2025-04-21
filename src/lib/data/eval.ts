import type { SupabaseClient } from '@supabase/supabase-js';
import type { EvalSection } from '../../app';

export async function fetchSections(
	evalCode: string,
	supabase: SupabaseClient
): Promise<EvalSection[]> {
	const { data: sections, error: sectionsError } = await supabase
		.from('eval_sections')
		.select('*, course:course_code(name)')
		.eq('eval_code', evalCode);

	if (sectionsError) {
		console.error('Error fetching sections:', sectionsError);
		return [];
	}

	return sections;
}
