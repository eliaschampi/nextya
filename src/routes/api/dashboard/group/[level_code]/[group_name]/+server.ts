import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getGroupDashboardData } from '$lib/data/dashboard';

export const GET: RequestHandler = async ({ params }) => {
	const { level_code, group_name } = params;

	if (!level_code || !group_name) {
		return json({ error: 'Código de nivel o nombre de grupo no proporcionado' }, { status: 400 });
	}

	try {
		// Get group dashboard data from the dedicated module
		const dashboardData = await getGroupDashboardData(level_code, group_name);

		if (!dashboardData) {
			return json({ error: 'No se pudieron obtener datos del dashboard' }, { status: 500 });
		}

		return json(dashboardData);
	} catch (error) {
		console.error('Error en endpoint de dashboard por grupo:', error);
		return json({ error: 'Error al procesar datos del dashboard' }, { status: 500 });
	}
};
