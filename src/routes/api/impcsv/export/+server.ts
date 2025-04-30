import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ApiErrorCode, ApiResponse } from '$lib/types/apiError';
import { createApiError } from '$lib/types/apiError';
import {
	exportEvaluationResultsToCsv,
	formatResultsForExport,
	getResultsExportHeaders,
	generateExcelCsv,
	createExportFilename,
	createCsvResponse
} from '$lib/csvProcessor';

/**
 * API endpoint for exporting evaluation results to CSV
 * Supports both GET (with eval_code parameter) and POST (with data in body)
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		// Get the evaluation code from the query parameters
		const evalCode = url.searchParams.get('eval_code');

		// Validate inputs
		if (!evalCode) {
			return json(
				{
					success: false,
					error: createApiError(
						'MISSING_EVAL_CODE' as ApiErrorCode,
						'No se ha proporcionado un código de evaluación'
					)
				} as ApiResponse<never>,
				{ status: 400 }
			);
		}

		// Usar la función modularizada para exportar los resultados
		const response = await exportEvaluationResultsToCsv(locals.supabase, evalCode);

		if (!response) {
			return json(
				{
					success: false,
					error: createApiError(
						'DATABASE_ERROR' as ApiErrorCode,
						'Error al obtener datos para la exportación'
					)
				} as ApiResponse<never>,
				{ status: 500 }
			);
		}

		return response;
	} catch (error) {
		console.error('Error exporting results:', error);
		const message = error instanceof Error ? error.message : 'Error desconocido';

		return json(
			{
				success: false,
				error: createApiError(
					'UNKNOWN_ERROR' as ApiErrorCode,
					`Error al exportar resultados: ${message}`
				)
			} as ApiResponse<never>,
			{ status: 500 }
		);
	}
};

/**
 * POST endpoint for exporting results
 * Receives data directly from the frontend to avoid an extra database call
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse the request body
		const body = await request.json();

		// Validate inputs
		if (!body.evalCode || !body.results || !Array.isArray(body.results)) {
			return json(
				{
					success: false,
					error: createApiError('INVALID_REQUEST' as ApiErrorCode, 'Datos de solicitud inválidos')
				} as ApiResponse<never>,
				{ status: 400 }
			);
		}

		// Format the data for export
		const exportData = formatResultsForExport(body.results);

		// Get standard headers
		const headers = getResultsExportHeaders();

		// Create filename
		const filename = createExportFilename(
			body.evalName || 'evaluacion',
			body.levelName || 'nivel',
			body.evalDate || new Date().toISOString()
		);

		// Generate CSV content with Excel compatibility
		const csvContent = await generateExcelCsv(exportData, headers);

		// Return the CSV file with appropriate headers
		return createCsvResponse(csvContent, filename);
	} catch (error) {
		console.error('Error exporting results:', error);
		const message = error instanceof Error ? error.message : 'Error desconocido';

		return json(
			{
				success: false,
				error: createApiError(
					'UNKNOWN_ERROR' as ApiErrorCode,
					`Error al exportar resultados: ${message}`
				)
			} as ApiResponse<never>,
			{ status: 500 }
		);
	}
};
