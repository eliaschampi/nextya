import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getGroupDashboardData } from '$lib/data/dashboard';

/**
 * GET endpoint for group dashboard data
 * Returns processed dashboard data for a specific level and group (scoresByEval and studentPerformance)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { level_code, group_name } = params;

	if (!level_code || !group_name) {
		return json({ error: 'Código de nivel o nombre de grupo no proporcionado' }, { status: 400 });
	}

	try {
		// Get group dashboard data from the dedicated module
		const dashboardData = await getGroupDashboardData(locals.db, level_code, group_name);

		if (!dashboardData) {
			return json({ error: 'No se pudieron obtener datos del dashboard' }, { status: 500 });
		}

		return json(dashboardData);
	} catch (error) {
		console.error('Error en endpoint de dashboard por grupo:', error);
		return json({ error: 'Error al procesar datos del dashboard' }, { status: 500 });
	}
};
