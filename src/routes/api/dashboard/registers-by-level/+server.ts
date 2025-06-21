import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// Get counts of registers grouped by level with level name
		const data = await locals.db
			.selectFrom('registers')
			.innerJoin('levels', 'levels.code', 'registers.level_code')
			.select(['registers.level_code', 'levels.name as level_name'])
			.orderBy('registers.level_code', 'asc')
			.execute();

		if (!data || data.length === 0) {
			return json([]);
		}

		// Process data to count registers by level
		const levelCounts = data.reduce(
			(acc: Record<string, { name: string; count: number }>, item) => {
				const levelCode = item.level_code;
				const levelName = item.level_name || 'Desconocido';

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
	} catch (error) {
		console.error('Error fetching registers by level:', error);
		return json(
			{ error: 'Error interno del servidor al obtener registros por nivel' },
			{ status: 500 }
		);
	}
};
