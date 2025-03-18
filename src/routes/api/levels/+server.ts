import { getLevels } from '$lib/data/levels';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	const levels = await getLevels(locals.supabase);
	return new Response(JSON.stringify({ levels }));
};
