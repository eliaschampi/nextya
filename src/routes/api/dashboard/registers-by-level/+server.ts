import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// Get counts of registers grouped by level with level name
		const { data, error } = await locals.supabase
			.from('registers')
			.select('level_code, levels!inner(name)')
			.order('level_code');

		if (error) {
			return json({ error: 'Error al obtener datos de registros por nivel' }, { status: 500 });
		}

		if (!data || !Array.isArray(data) || data.length === 0) {
			return json([]);
		}

		// Process data to count registers by level
		const levelCounts = data.reduce(
			(acc: Record<string, { name: string; count: number }>, item) => {
				if (!item || !item.level_code) return acc;

				const levelCode = item.level_code;
				const levelName = item.levels?.name || 'Desconocido';

				if (!acc[levelCode]) {
					acc[levelCode] = { name: levelName, count: 0 };
				}

				acc[levelCode].count++;
				return acc;
			},
			{}
		);

		// Convert to array format for chart
		const result = Object.entries(levelCounts).map(([, level]) => ({
			name: level.name,
			count: level.count
		}));
		return json(result);
	} catch {
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
