import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getEvalDashboardData } from '$lib/data/evalDashboard';

/**
 * GET endpoint for evaluation dashboard data
 * Returns processed dashboard data for a specific evaluation
 * (topCorrectQuestions, topIncorrectQuestions, and scoreDistribution)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { eval_code } = params;

	if (!eval_code) {
		return json({ error: 'Código de evaluación no proporcionado' }, { status: 400 });
	}

	try {
		// Get evaluation dashboard data from the dedicated module
		const dashboardData = await getEvalDashboardData(eval_code);

		if (!dashboardData) {
			return json({ error: 'No se pudieron obtener datos del dashboard' }, { status: 500 });
		}

		return json(dashboardData);
	} catch (error) {
		console.error('Error en endpoint de dashboard por evaluación:', error);
		return json({ error: 'Error al procesar datos del dashboard' }, { status: 500 });
	}
};
