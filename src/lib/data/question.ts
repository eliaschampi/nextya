import type { SupabaseClient } from '@supabase/supabase-js';
import type { EvalQuestion } from '$lib/types';

export async function fetchQuestions(
	evalCode: string,
	supabase: SupabaseClient
): Promise<EvalQuestion[]> {
	const { data, error } = await supabase
		.from('eval_questions')
		.select('*')
		.eq('eval_code', evalCode)
		.order('order_in_eval');

	if (error || !data) {
		return [];
	}
	return data as EvalQuestion[];
}

export async function hasEvalQuestions(
	supabase: SupabaseClient,
	evalCode: string
): Promise<boolean> {
	const { data, error } = await supabase
		.from('eval_questions')
		.select('code')
		.eq('eval_code', evalCode)
		.limit(1);

	return !error && data && data.length > 0;
}
