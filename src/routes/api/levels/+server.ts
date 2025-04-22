import { getLevels } from '$lib/data/levels';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.session?.user.id;
	let levels = [];
	if (userId) {
		levels = await getLevels(locals.supabase, userId);
	}
	return new Response(JSON.stringify({ levels }));
};
