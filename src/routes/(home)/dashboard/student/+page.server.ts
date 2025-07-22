import { getLevels } from '$lib/data/levels';
import type { Levels } from '$lib/types';
import type { PageServerLoad } from '../$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.code;
	let levels: Levels[] = [];

	if (userId && (await locals.can('dashboard:students'))) {
		levels = await getLevels(locals.db, userId);
	}

	return {
		levels,
		title: 'Estudiante'
	};
};
