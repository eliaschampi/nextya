import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { code } = params;
	if (!code) return json([]);

	try {
		const evals = await locals.db
			.selectFrom('evals')
			.innerJoin('levels', 'levels.code', 'evals.level_code')
			.leftJoin('eval_sections', 'eval_sections.eval_code', 'evals.code')
			.leftJoin('courses', 'courses.code', 'eval_sections.course_code')
			.select([
				'evals.code',
				'evals.name',
				'evals.level_code',
				'evals.group_name',
				'evals.eval_date',
				'evals.user_code',
				'evals.created_at',
				'evals.updated_at',
				'levels.name as level_name',
				'eval_sections.code as section_code',
				'eval_sections.course_code',
				'eval_sections.order_in_eval',
				'eval_sections.question_count',
				'courses.name as course_name'
			])
			.where('evals.level_code', '=', code)
			.orderBy('evals.eval_date', 'asc')
			.execute();

		// Group sections by eval
		const evalMap = new Map();

		evals.forEach((row) => {
			if (!evalMap.has(row.code)) {
				evalMap.set(row.code, {
					code: row.code,
					name: row.name,
					level_code: row.level_code,
					groupName: row.group_name,
					evalDate: row.eval_date,
					userCode: row.user_code,
					createdAt: row.created_at,
					updatedAt: row.updated_at,
					levels: { name: row.level_name },
					eval_sections: []
				});
			}

			if (row.section_code) {
				evalMap.get(row.code).eval_sections.push({
					code: row.section_code,
					eval_code: row.code,
					course_code: row.course_code,
					order_in_eval: row.order_in_eval,
					question_count: row.question_count,
					course_name: row.course_name || 'Sin nombre'
				});
			}
		});

		return json(Array.from(evalMap.values()));
	} catch (error) {
		console.error('Error fetching evals:', error);
		return json([], { status: 500 });
	}
};
