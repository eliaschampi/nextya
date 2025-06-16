import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ApiErrorCode, ApiResponse } from '$lib/types/apiError';
import { createApiError } from '$lib/types/apiError';
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
			return json(
				{
					success: false,
					error: createApiError(
						'MISSING_STUDENT_CODE' as ApiErrorCode,
						'No se ha proporcionado un código de estudiante'
					)
				} as ApiResponse<never>,
				{ status: 400 }
			);
		}

		// Get student information
		const { data: student, error: studentError } = await locals.db
			.from('students')
			.select('name, last_name')
			.eq('code', studentCode)
			.single();

		if (studentError) {
			return json(
				{
					success: false,
					error: createApiError(
						'STUDENT_NOT_FOUND' as ApiErrorCode,
						'No se encontró el estudiante especificado'
					)
				} as ApiResponse<never>,
				{ status: 404 }
			);
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
				{
					success: false,
					error: createApiError(
						'NO_DATA' as ApiErrorCode,
						'No hay evaluaciones disponibles para este estudiante'
					)
				} as ApiResponse<never>,
				{ status: 404 }
			);
		}

		return response;
	} catch (error) {
		console.error('Error exporting student evaluations:', error);
		const message = error instanceof Error ? error.message : 'Error desconocido';

		return json(
			{
				success: false,
				error: createApiError(
					'UNKNOWN_ERROR' as ApiErrorCode,
					`Error al exportar evaluaciones: ${message}`
				)
			} as ApiResponse<never>,
			{ status: 500 }
		);
	}
};
