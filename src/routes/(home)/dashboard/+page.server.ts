import { getLevels } from '$lib/data/levels';
import type { Levels } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userCode = locals.user?.code;
	let levels: Levels[] = [];

	if (userCode) {
		levels = await getLevels(locals.db, userCode);
	}

	return {
		levels,
		title: 'Dashboard'
	};
};
