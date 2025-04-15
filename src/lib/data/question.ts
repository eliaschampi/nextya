import type { SupabaseClient } from '@supabase/supabase-js';
import type { EvalQuestion } from '../../app';

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
