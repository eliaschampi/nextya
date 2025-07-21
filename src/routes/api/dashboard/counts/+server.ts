import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sql } from 'kysely';

/**
 * GET endpoint for dashboard counts
 * Returns counts of students, evaluations, levels, and courses
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		// Run queries in parallel for better performance using Kysely
		const [studentsCount, evalsCount, levelsCount, coursesCount] = await Promise.all([
			// Get student count
			locals.db
				.selectFrom('students')
				.select(sql<number>`count(*)`.as('count'))
				.executeTakeFirst(),

			// Get evaluations count
			locals.db
				.selectFrom('evals')
				.select(sql<number>`count(*)`.as('count'))
				.executeTakeFirst(),

			// Get levels count
			locals.db
				.selectFrom('levels')
				.select(sql<number>`count(*)`.as('count'))
				.executeTakeFirst(),

			// Get courses count
			locals.db
				.selectFrom('courses')
				.select(sql<number>`count(*)`.as('count'))
				.executeTakeFirst()
		]);

		// Return counts
		return json({
			students: Number(studentsCount?.count) || 0,
			evals: Number(evalsCount?.count) || 0,
			levels: Number(levelsCount?.count) || 0,
			courses: Number(coursesCount?.count) || 0
		});
	} catch (error) {
		console.error('Error in dashboard counts endpoint:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
