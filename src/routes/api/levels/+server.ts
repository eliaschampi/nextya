import { getLevels } from '$lib/data/levels';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const levels = await getLevels(locals.db, locals.user.code);
	return json({ levels });
};
