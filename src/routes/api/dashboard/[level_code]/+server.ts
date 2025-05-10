import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getDashboardData } from '$lib/data/dashboard';

/**
 * GET endpoint for dashboard data
 * Returns processed dashboard data for a specific level
 * Supports optional group_filter parameter
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const { level_code } = params;
	const groupFilter = url.searchParams.get('group_filter');

	if (!level_code || !groupFilter) {
		return json({ error: 'Código de nivel no proporcionado' }, { status: 400 });
	}

	try {
		// Get dashboard data from the dedicated module with optional group filter
		const dashboardData = await getDashboardData(locals.supabase, level_code, false, groupFilter);

		if (!dashboardData) {
			return json({ error: 'No se pudieron obtener datos del dashboard' }, { status: 500 });
		}

		return json(dashboardData);
	} catch (error) {
		console.error('Error en endpoint de dashboard:', error);
		return json({ error: 'Error al procesar datos del dashboard' }, { status: 500 });
	}
};
