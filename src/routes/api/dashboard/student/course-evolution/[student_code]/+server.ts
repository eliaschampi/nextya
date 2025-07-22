import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getStudentCourseEvolution } from '$lib/data/dashboard/student';

/**
 * GET endpoint for student course evolution data
 * Returns course evolution data for a specific student
 * Optional query parameter: course_code - filters results by specific course
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const { student_code } = params;
	const course_code = url.searchParams.get('course_code');

	if (!student_code) {
		return json({ error: 'Código de estudiante no proporcionado' }, { status: 400 });
	}

	try {
		const data = await getStudentCourseEvolution(locals.db, student_code, course_code || undefined);

		if (!data) {
			return json(
				{ error: 'No se pudieron obtener datos de evolución por curso' },
				{ status: 500 }
			);
		}

		return json(data);
	} catch (error) {
		console.error('Error en endpoint de evolución por curso:', error);
		return json({ error: 'Error al procesar datos de evolución por curso' }, { status: 500 });
	}
};
