import type { SupabaseClient } from '@supabase/supabase-js';

// src/lib/data/levels.ts
export async function getLevels(supabase: SupabaseClient) {
	const { data: levels, error } = await supabase.from('levels').select('*');
	return error ? [] : levels;
}
