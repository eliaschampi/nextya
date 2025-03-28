import type { SupabaseClient } from '@supabase/supabase-js';

export async function getEvalsByLevel(supabase: SupabaseClient, levelCode: string) {
	const { data, error } = await supabase
		.from('evals')
		.select(
			`
      *,
      levels!inner (name),
      eval_sections (
        code,
        order_in_eval,
        question_count,
        courses!inner (name, code)
      )
    `
		)
		.eq('level_code', levelCode)
		.order('eval_date', { ascending: false });

	return error ? [] : data;
}

export async function searchEvals(supabase: SupabaseClient, searchTerm: string) {
	const { data, error } = await supabase
		.from('evals')
		.select(
			`
      *,
      levels (name)
    `
		)
		.ilike('name', `%${searchTerm}%`)
		.order('name')
		.limit(10);

	return error ? [] : data;
}

export async function getEvalSections(supabase: SupabaseClient, evalCode: string) {
	const { data, error } = await supabase
		.from('eval_sections')
		.select(
			`
      *,
      courses (name, code)
    `
		)
		.eq('eval_code', evalCode)
		.order('order_in_eval');

	return error ? [] : data;
}
