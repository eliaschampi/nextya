import { db } from '$lib/database';
import type { EvalSectionWithCourse } from '$lib/types';

export async function fetchSections(evalCode: string): Promise<EvalSectionWithCourse[]> {
	try {
		const sections = await db
			.selectFrom('evalSections')
			.innerJoin('courses', 'courses.code', 'evalSections.courseCode')
			.select([
				'evalSections.code',
				'evalSections.evalCode',
				'evalSections.courseCode',
				'evalSections.orderInEval',
				'evalSections.questionCount',
				'courses.name as courseName'
			])
			.where('evalSections.evalCode', '=', evalCode)
			.orderBy('evalSections.orderInEval', 'asc')
			.execute();

		// Transform to match expected EvalSectionWithCourse interface
		return sections.map(section => ({
			code: section.code,
			eval_code: section.evalCode,
			course_code: section.courseCode,
			order_in_eval: section.orderInEval,
			question_count: section.questionCount,
			course: { name: section.courseName }
		})) as EvalSectionWithCourse[];
	} catch (error) {
		console.error('Error fetching sections:', error);
		return [];
	}
}
