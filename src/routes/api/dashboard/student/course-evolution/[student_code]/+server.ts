import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getStudentCourseEvolution } from '$lib/data/studentDashboard';

/**
 * GET endpoint for student course evolution data
 * Returns course evolution data for a specific student
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { student_code } = params;

	if (!student_code) {
		return json({ error: 'Código de estudiante no proporcionado' }, { status: 400 });
	}

	try {
		const data = await getStudentCourseEvolution(locals.supabase, student_code);

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
