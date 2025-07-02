import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getStudentCourseScores } from '$lib/data/dashboard/student';

/**
 * GET endpoint for student course scores data
 * Returns average scores by course for a specific student
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { student_code } = params;

	if (!student_code) {
		return json({ error: 'Código no proporcionado' }, { status: 400 });
	}

	try {
		const data = await getStudentCourseScores(locals.db, student_code);

		if (!data) {
			return json({ error: 'No se pudieron obtener datos de cursos' }, { status: 500 });
		}

		return json(data);
	} catch (error) {
		console.error('Error en endpoint de scores de cursos:', error);
		return json({ error: 'Error al procesar datos de cursos' }, { status: 500 });
	}
};
