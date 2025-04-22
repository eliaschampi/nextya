import type { SupabaseClient } from '@supabase/supabase-js';

// src/lib/data/levels.ts
export async function getLevels(supabase: SupabaseClient, userID: string) {
	const { data: levels, error } = await supabase
		.from('levels')
		.select('*')
		.contains('users', [userID]);
	return error ? [] : levels;
}
