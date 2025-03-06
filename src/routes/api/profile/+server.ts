// create a server endpoint profile
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.getUser();
	if (!user) return json({ error: 'No autorizado' }, { status: 401 });

	const { data: profile, error } = await locals.supabase
		.from('profiles')
		.select('*')
		.eq('code', user.id);
	if (error) return json({ error: error.message }, { status: 400 });

	return json({ profile });
};
