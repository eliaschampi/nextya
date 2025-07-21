import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportStudentEvaluationsToCsv } from '$lib/csvProcessor/studentExport';

/**
 * API endpoint for exporting student evaluation results to CSV
 * Accepts a student_code parameter and returns a CSV file with all evaluations and course-specific scores
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		// Get the student code from the query parameters
		const studentCode = url.searchParams.get('student_code');

		// Validate inputs
		if (!studentCode) {
			return json({ error: 'No se ha proporcionado un código de estudiante' }, { status: 400 });
		}

		// Get student information
		const student = await locals.db
			.selectFrom('students')
			.select(['name', 'last_name'])
			.where('code', '=', studentCode)
			.executeTakeFirst();

		if (!student) {
			return json({ error: 'No se encontró el estudiante especificado' }, { status: 404 });
		}

		// Use the modularized function to export the student evaluations
		const response = await exportStudentEvaluationsToCsv(
			locals.db,
			studentCode,
			student.name,
			student.last_name
		);

		if (!response) {
			return json(
				{ error: 'No hay evaluaciones disponibles para este estudiante' },
				{ status: 404 }
			);
		}

		return response;
	} catch (error) {
		console.error('Error exporting student evaluations:', error);
		return json({ error: 'Error al exportar evaluaciones' }, { status: 500 });
	}
};
