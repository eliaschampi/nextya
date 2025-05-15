import { getLevels } from '$lib/data/levels';
import type { PageServerLoad } from '../$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.session?.user.id;
	let levels = [];

	// Get parameters from URL
	const levelCode = url.searchParams.get('level');
	const evalCode = url.searchParams.get('eval');

	if (userId) {
		levels = await getLevels(locals.supabase, userId);
	}

	return {
		levels,
		title: 'Dashboard de Evaluación',
		levelCode,
		evalCode
	};
};
