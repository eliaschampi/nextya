import { getLevels } from '$lib/data/levels';
import type { Levels } from '$lib/types';
import type { PageServerLoad } from '../$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.user?.code;
	let levels: Levels[] = [];

	// Get parameters from URL
	const levelCode = url.searchParams.get('level');
	const evalCode = url.searchParams.get('eval');

	if (userId) {
		levels = await getLevels(userId);
	}

	return {
		levels,
		title: 'Dashboard de Evaluación',
		levelCode,
		evalCode
	};
};
