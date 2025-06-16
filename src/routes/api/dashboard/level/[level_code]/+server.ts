import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getLevelDashboardData } from '$lib/data/dashboard';

/**
 * GET endpoint for level dashboard data
 * Returns processed dashboard data for a specific level (scoresByGroup and correctVsIncorrect)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { level_code } = params;

	if (!level_code) {
		return json({ error: 'Código de nivel no proporcionado' }, { status: 400 });
	}

	try {
		// Get level dashboard data from the dedicated module
		const dashboardData = await getLevelDashboardData(locals.db, level_code);

		if (!dashboardData) {
			return json({ error: 'No se pudieron obtener datos del dashboard' }, { status: 500 });
		}

		return json(dashboardData);
	} catch (error) {
		console.error('Error en endpoint de dashboard por nivel:', error);
		return json({ error: 'Error al procesar datos del dashboard' }, { status: 500 });
	}
};
