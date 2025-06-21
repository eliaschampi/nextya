import { db } from '$lib/database';
import type { EvalSectionWithCourse } from '$lib/types';

export async function fetchSections(evalCode: string): Promise<EvalSectionWithCourse[]> {
	try {
		const sections = await db
			.selectFrom('eval_sections')
			.innerJoin('courses', 'courses.code', 'eval_sections.course_code')
			.select([
				'eval_sections.code',
				'eval_sections.eval_code',
				'eval_sections.course_code',
				'eval_sections.order_in_eval',
				'eval_sections.question_count',
				'courses.name as course_name'
			])
			.where('eval_sections.eval_code', '=', evalCode)
			.orderBy('eval_sections.order_in_eval', 'asc')
			.execute();

		return sections.map((section) => ({
			code: section.code,
			eval_code: section.eval_code,
			course_code: section.course_code,
			order_in_eval: section.order_in_eval,
			question_count: section.question_count,
			course_name: section.course_name,
			courses: { name: section.course_name }
		}));
	} catch {
		return [];
	}
}
