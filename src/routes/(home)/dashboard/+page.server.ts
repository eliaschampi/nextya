import { getLevels } from '$lib/data/levels';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userCode = locals.user?.code;
	let levels = [];

	if (userCode) {
		levels = await getLevels(userCode);
	}

	return {
		levels,
		title: 'Dashboard'
	};
};
