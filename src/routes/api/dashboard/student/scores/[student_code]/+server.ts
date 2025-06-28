import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getStudentScoreEvolution } from '$lib/data/dashboard/student';

/**
 * GET endpoint for student score evolution data
 * Returns score evolution data for a specific student
 */
export const GET: RequestHandler = async ({ params }) => {
	const { student_code } = params;

	if (!student_code) {
		return json({ error: 'Código no proporcionado' }, { status: 400 });
	}

	try {
		const data = await getStudentScoreEvolution(student_code);

		if (!data) {
			return json({ error: 'No se pudieron Obtener Datos' }, { status: 500 });
		}

		return json(data);
	} catch (error) {
		console.error('Error en endpoint de evolución de puntajes:', error);
		return json({ error: 'Error al procesar datos de evolución de puntajes' }, { status: 500 });
	}
};
