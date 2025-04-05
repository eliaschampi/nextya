import type { PageServerLoad } from './$types';
import type { Level } from '../../../../app';

export const load: PageServerLoad = async ({ locals }) => {
	const { data: levels } = await locals.supabase.from('levels').select('*').order('name');
	return {
		levels: levels as Level[],
		title: 'Procesar evaluacion'
	};
};
