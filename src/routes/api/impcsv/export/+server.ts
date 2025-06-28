import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
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
export const GET: RequestHandler = async ({ url }) => {
	try {
		// Get the evaluation code from the query parameters
		const evalCode = url.searchParams.get('eval_code');

		// Validate inputs
		if (!evalCode) {
			return json({ error: 'No se ha proporcionado un código de evaluación' }, { status: 400 });
		}

		// Usar la función modularizada para exportar los resultados
		const response = await exportEvaluationResultsToCsv(evalCode);

		if (!response) {
			return json({ error: 'Error al obtener datos para la exportación' }, { status: 500 });
		}

		return response;
	} catch (error) {
		console.error('Error exporting results:', error);
		return json({ error: 'Error al exportar resultados' }, { status: 500 });
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
			return json({ error: 'Datos de solicitud inválidos' }, { status: 400 });
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
		return json({ error: 'Error al exportar resultados' }, { status: 500 });
	}
};
