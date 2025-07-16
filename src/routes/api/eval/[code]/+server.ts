import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { code } = params;
	if (!code || !(await locals.can('evals:read'))) {
		return json([]);
	}

	try {
		// Use optimized PostgreSQL view with pre-aggregated sections
		const evals = await locals.db
			.selectFrom('evals_with_sections')
			.select([
				'code',
				'name',
				'level_code',
				'group_name',
				'eval_date',
				'user_code',
				'created_at',
				'updated_at',
				'level_name',
				'eval_sections'
			])
			.where('level_code', '=', code)
			.orderBy('eval_date', 'asc')
			.execute();

		// Transform the result to match expected frontend format (snake_case)
		const transformedEvals = evals.map((evalItem) => ({
			code: evalItem.code,
			name: evalItem.name,
			level_code: evalItem.level_code,
			group_name: evalItem.group_name,
			eval_date: evalItem.eval_date,
			user_code: evalItem.user_code,
			created_at: evalItem.created_at,
			updated_at: evalItem.updated_at,
			levels: { name: evalItem.level_name },
			eval_sections: Array.isArray(evalItem.eval_sections) ? evalItem.eval_sections : []
		}));

		return json(transformedEvals);
	} catch (error) {
		console.error('Error fetching evals:', error);
		return json({ error: 'Error interno del servidor al obtener evaluaciones' }, { status: 500 });
	}
};
