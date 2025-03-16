import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const search = url.searchParams.get('search')?.trim() || '';

	if (!search) return json([]);

	const { data, error } = await locals.supabase
		.from('students')
		.select('*')
		.or(`name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
		.limit(10);

	if (error) {
		return json({ error: error.message }, { status: 500 });
	}

	return json(data);
};
