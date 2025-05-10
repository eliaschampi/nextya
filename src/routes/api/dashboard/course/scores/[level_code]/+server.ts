import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getCourseScores } from '$lib/data/courseDashboard';

/**
 * GET endpoint for course scores data
 * Returns average scores by course for a specific level
 * Requires group_name parameter
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const { level_code } = params;
	const groupName = url.searchParams.get('group_name');

	if (!level_code) {
		return json({ error: 'Código de nivel no proporcionado' }, { status: 400 });
	}

	if (!groupName) {
		return json({ error: 'Parámetro group_name es obligatorio' }, { status: 400 });
	}

	try {
		const data = await getCourseScores(locals.supabase, level_code, groupName);

		if (!data) {
			return json({ error: 'No se pudieron obtener datos de cursos' }, { status: 500 });
		}

		return json(data);
	} catch (error) {
		console.error('Error en endpoint de scores de cursos:', error);
		return json({ error: 'Error al procesar datos de cursos' }, { status: 500 });
	}
};
