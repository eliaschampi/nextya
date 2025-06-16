import { db } from '$lib/database';
import type { Course } from '$lib/types';

export async function getCourses(): Promise<Course[]> {
	try {
		const courses = await db
			.selectFrom('courses')
			.selectAll()
			.orderBy('order', 'asc')
			.execute();

		// Transform to match expected Course interface
		return courses.map(course => ({
			code: course.code,
			name: course.name,
			order: course.order,
			created_at: course.createdAt?.toISOString() || null,
			user_code: course.userCode
		})) as Course[];
	} catch (error) {
		console.error('Error fetching courses:', error);
		return [];
	}
}

/**
 * Updates the order of a course
 * @param courseCode Course code to update
 * @param newOrder New order value
 * @returns True if successful, false otherwise
 */
export async function updateCourseOrder(
	courseCode: string,
	newOrder: number
): Promise<boolean> {
	try {
		await db
			.updateTable('courses')
			.set({ order: newOrder })
			.where('code', '=', courseCode)
			.execute();
		return true;
	} catch (error) {
		console.error('Error updating course order:', error);
		return false;
	}
}

/**
 * Reorders courses when moving a course up or down
 * @param courses List of all courses
 * @param courseCode Course code to move
 * @param direction 'up' or 'down'
 * @returns True if successful, false otherwise
 */
export async function reorderCourse(
	courses: Course[],
	courseCode: string,
	direction: 'up' | 'down'
): Promise<boolean> {
	try {
		// Find the current course and its index
		const currentIndex = courses.findIndex((c) => c.code === courseCode);
		if (currentIndex === -1) return false;

		// Calculate target index based on direction
		const targetIndex =
			direction === 'up'
				? Math.max(0, currentIndex - 1)
				: Math.min(courses.length - 1, currentIndex + 1);

		// If already at the top/bottom, do nothing
		if (targetIndex === currentIndex) return true;

		// Get the course to swap with
		const targetCourse = courses[targetIndex];
		const currentCourse = courses[currentIndex];

		// Swap orders
		const currentOrder = currentCourse.order;
		const targetOrder = targetCourse.order;

		// Update both courses in a transaction-like manner
		await Promise.all([
			db.updateTable('courses')
				.set({ order: targetOrder })
				.where('code', '=', currentCourse.code)
				.execute(),
			db.updateTable('courses')
				.set({ order: currentOrder })
				.where('code', '=', targetCourse.code)
				.execute()
		]);

		return true;
	} catch (error) {
		console.error('Error reordering courses:', error);
		return false;
	}
}
