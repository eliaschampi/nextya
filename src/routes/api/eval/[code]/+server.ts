import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { code } = params;
	if (!code) return json([]);

	try {
		const evals = await locals.db
			.selectFrom('evals')
			.innerJoin('levels', 'levels.code', 'evals.levelCode')
			.leftJoin('evalSections', 'evalSections.evalCode', 'evals.code')
			.leftJoin('courses', 'courses.code', 'evalSections.courseCode')
			.select([
				'evals.code',
				'evals.name',
				'evals.levelCode',
				'evals.groupName',
				'evals.evalDate',
				'evals.userCode',
				'evals.createdAt',
				'evals.updatedAt',
				'levels.name as levelName',
				'evalSections.code as sectionCode',
				'evalSections.courseCode',
				'evalSections.orderInEval',
				'evalSections.questionCount',
				'courses.name as courseName'
			])
			.where('evals.levelCode', '=', code)
			.orderBy('evals.evalDate', 'asc')
			.execute();

		// Group sections by eval
		const evalMap = new Map();

		evals.forEach(row => {
			if (!evalMap.has(row.code)) {
				evalMap.set(row.code, {
					code: row.code,
					name: row.name,
					levelCode: row.levelCode,
					groupName: row.groupName,
					evalDate: row.evalDate,
					userCode: row.userCode,
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
					levels: { name: row.levelName },
					eval_sections: []
				});
			}

			if (row.sectionCode) {
				evalMap.get(row.code).eval_sections.push({
					code: row.sectionCode,
					eval_code: row.code,
					course_code: row.courseCode,
					order_in_eval: row.orderInEval,
					question_count: row.questionCount,
					course_name: row.courseName || 'Sin nombre'
				});
			}
		});

		return json(Array.from(evalMap.values()));
	} catch (error) {
		console.error('Error fetching evals:', error);
		return json([], { status: 500 });
	}
};
