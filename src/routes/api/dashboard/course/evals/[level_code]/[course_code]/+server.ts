import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getEvalScores } from '$lib/data/courseDashboard';

/**
 * GET endpoint for evaluation scores data
 * Returns average scores by evaluation for a specific level, course and group
 * Requires group_name parameter
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const { level_code, course_code } = params;
	const groupName = url.searchParams.get('group_name');

	if (!level_code || !course_code) {
		return json({ error: 'Código de nivel o curso no proporcionado' }, { status: 400 });
	}

	if (!groupName) {
		return json({ error: 'Parámetro group_name es obligatorio' }, { status: 400 });
	}

	try {
		const data = await getEvalScores(locals.db, level_code, course_code, groupName);

		if (data === null) {
			return json({ error: 'Error al procesar datos de evaluaciones' }, { status: 500 });
		}

		return json(data);
	} catch (error) {
		console.error('Error en endpoint de scores de evaluaciones:', error);
		return json({ error: 'Error al procesar datos de evaluaciones' }, { status: 500 });
	}
};
