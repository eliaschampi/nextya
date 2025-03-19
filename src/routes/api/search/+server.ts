import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals, url }) => {
	const searchQuery = url.searchParams.get('search');

	if (!searchQuery) {
		return new Response(JSON.stringify({ students: [] }));
	}

	const { data: students, error } = await locals.supabase
		.from('students')
		.select('*')
		.ilike('name', `%${searchQuery}%`)
		.or(`last_name.ilike.%${searchQuery}%`);
	if (error) {
		return new Response(JSON.stringify({ students: [] }));
	}

	return new Response(JSON.stringify({ students }));
};
