import { supabaseAdmin } from '$lib/supabaseAdmin';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const {
		data: { users },
		error
	} = await supabaseAdmin.auth.admin.listUsers();
	if (error) {
		return json([]);
	}

	// map to only id + metadata fields
	const simple = users.map((u) => ({
		id: u.id,
		name: u.user_metadata.name,
		last_name: u.user_metadata.last_name
	}));

	return json(simple);
};
