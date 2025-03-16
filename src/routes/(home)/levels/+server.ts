import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const { data, error } = await locals.supabase.from('levels').select('code, name');

	if (error) {
		return json({ error: error.message }, { status: 500 });
	}

	return json(data);
};
