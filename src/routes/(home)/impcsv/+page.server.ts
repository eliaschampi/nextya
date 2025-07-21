import { getLevels } from '$lib/data/levels';
import type { Levels } from '$lib/types';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!(await locals.can('students:import'))) {
		throw error(403, 'Acceso no autorizado');
	}
	const userId = locals.user?.code;
	let levels: Levels[] = [];
	if (userId) {
		levels = await getLevels(locals.db, userId);
	}
	return { levels, title: 'Importar Estudiantes' };
};
