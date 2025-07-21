import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportEvalDetailedToCsv } from '$lib/csvProcessor';
import { fetchEvaluationData } from '$lib/csvProcessor';

/**
 * API endpoint for exporting detailed evaluation results to CSV
 * Supports GET with eval_code parameter and returns a CSV file with course-specific scores
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		// Get the evaluation code from the query parameters
		const evalCode = url.searchParams.get('eval_code');

		// Validate inputs
		if (!evalCode) {
			return json({ error: 'No se ha proporcionado un código de evaluación' }, { status: 400 });
		}

		// Get evaluation data for metadata
		const evalData = await fetchEvaluationData(locals.db, evalCode);
		if (!evalData) {
			return json({ error: 'No se encontró la evaluación especificada' }, { status: 404 });
		}

		// Extract the level name (levels can be an object or an array with an object)
		let levelName = 'nivel';
		if (evalData.levels) {
			// If levels is an array, take the first element
			if (Array.isArray(evalData.levels)) {
				levelName = evalData.levels[0]?.name || levelName;
			}
			// If levels is an object with name property
			else if (typeof evalData.levels === 'object' && evalData.levels.name) {
				levelName = evalData.levels.name;
			}
		}

		// Use the modularized function to export the detailed results
		const response = await exportEvalDetailedToCsv(
			locals.db,
			evalCode,
			evalData.name || 'evaluacion',
			levelName,
			evalData.eval_date || new Date().toISOString()
		);

		if (!response) {
			return json(
				{ error: 'No hay resultados detallados disponibles para esta evaluación' },
				{ status: 404 }
			);
		}

		return response;
	} catch (error) {
		console.error('Error exporting detailed evaluation results:', error);
		return json({ error: 'Error al exportar resultados detallados' }, { status: 500 });
	}
};
