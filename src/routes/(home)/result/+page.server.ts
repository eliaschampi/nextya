import type { PageServerLoad } from './$types';
import { getLevels } from '$lib/data/levels';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.user?.code;
	let levels = [];

	// Get parameters from URL
	const levelCode = url.searchParams.get('level');
	const evalCode = url.searchParams.get('eval');

	if (userId) {
		levels = await getLevels(locals.db, userId);
	}

	return {
		levels,
		title: 'Resultados',
		levelCode,
		evalCode
	};
};
