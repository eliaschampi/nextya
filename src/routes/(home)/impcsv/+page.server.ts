import { getLevels } from '$lib/data/levels';
import type { Levels } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.code;
	let levels: Levels[] = [];
	if (userId) {
		levels = await getLevels(userId);
	}
	return { levels, title: 'Importar Estudiantes' };
};
