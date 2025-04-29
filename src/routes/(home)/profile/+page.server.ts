import { getLevels } from '$lib/data/levels';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.session?.user.id;
	let levels = [];

	if (userId) {
		levels = await getLevels(locals.supabase, userId);
	}

	return {
		levels,
		user: locals.session?.user || null,
		title: 'Mi perfil'
	};
};
