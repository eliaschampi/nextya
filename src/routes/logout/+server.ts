import { redirect, fail } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const { error } = await locals.supabase.auth.signOut();
	if (error) {
		throw fail(500, { message: 'Ocurrio algo inesperado' });
	}
	throw redirect(303, '/auth');
};
