import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals, url }) => {
	const searchQuery = url.searchParams.get('search');

	if (!searchQuery) {
		return new Response(JSON.stringify([]));
	}

	const { data: students, error } = await locals.supabase
		.from('students')
		.select('*')
		.or(`name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`);

	if (error) {
		return new Response(JSON.stringify([]), { status: 500 });
	}

	return new Response(JSON.stringify(students));
};
