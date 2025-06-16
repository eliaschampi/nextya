import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	// Check permissions
	if (!locals.user) {
		return json({ error: 'No Autorizado' }, { status: 401 });
	}

	// Get users from database
	const users = await locals.db
		.selectFrom('users')
		.select(['code as id', 'name', 'lastName'])
		.execute();

	return json(users);
};
