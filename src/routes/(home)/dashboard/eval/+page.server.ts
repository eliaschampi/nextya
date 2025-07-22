import { getLevels } from '$lib/data/levels';
import type { Levels } from '$lib/types';
import type { PageServerLoad } from '../$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.user?.code;
	let levels: Levels[] = [];

	// Get parameters from URL
	const levelCode = url.searchParams.get('level');
	const evalCode = url.searchParams.get('eval');

	if (userId && (await locals.can('dashboard:evals'))) {
		levels = await getLevels(locals.db, userId);
	}

	return {
		levels,
		title: 'Gráficos de Evaluación',
		levelCode,
		evalCode
	};
};
