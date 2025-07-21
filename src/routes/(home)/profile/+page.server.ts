import { getLevels } from '$lib/data/levels';
import type { Levels } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.code;
	let levels: Levels[] = [];

	if (userId) {
		levels = await getLevels(locals.db, userId);
	}

	return {
		levels,
		user: locals.session?.user || null,
		title: 'Mi perfil'
	};
};
