/**
 * COURSES DATA LAYER - Modern Clean Architecture
 *
 * ARCHITECTURE PRINCIPLE: Use locals.db to avoid duplicate instances
 */

import type { Courses } from '$lib/types';
import type { Database } from '$lib/database';

/**
 * Get all courses ordered by display order
 */
export async function getCourses(db: Database): Promise<Courses[]> {
	try {
		return await db.selectFrom('courses').selectAll().orderBy('order', 'asc').execute();
	} catch (error) {
		console.error('Error fetching courses:', error);
		return [];
	}
}

/**
 * Update course order
 */
export async function updateCourseOrder(db: Database, courseCode: string, newOrder: number): Promise<boolean> {
	try {
		const result = await db
			.updateTable('courses')
			.set({ order: newOrder })
			.where('code', '=', courseCode)
			.execute();

		return result.length > 0;
	} catch (error) {
		console.error('Error updating course order:', error);
		return false;
	}
}

/**
 * Reorder course (move up/down)
 */
export async function reorderCourse(
	db: Database,
	courses: Courses[],
	courseCode: string,
	direction: 'up' | 'down'
): Promise<boolean> {
	try {
		// Find the current course
		const currentCourse = courses.find((c) => c.code === courseCode);
		if (!currentCourse) return false;

		// Find the target course to swap with
		const currentIndex = courses.findIndex((c) => c.code === courseCode);
		const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

		if (targetIndex < 0 || targetIndex >= courses.length) return false;

		const targetCourse = courses[targetIndex];

		// Swap the order values
		await Promise.all([
			db
				.updateTable('courses')
				.set({ order: targetCourse.order })
				.where('code', '=', courseCode)
				.execute(),
			db
				.updateTable('courses')
				.set({ order: currentCourse.order })
				.where('code', '=', targetCourse.code)
				.execute()
		]);

		return true;
	} catch (error) {
		console.error('Error reordering course:', error);
		return false;
	}
}
