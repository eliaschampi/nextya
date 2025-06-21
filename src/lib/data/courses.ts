import { db } from '$lib/database';
import type { Courses } from '$lib/types';

export async function getCourses(): Promise<Courses[]> {
	try {
		const courses = await db.selectFrom('courses').selectAll().orderBy('order', 'asc').execute();

		// Transform to match expected Course interface
		return courses.map((course) => ({
			code: course.code,
			name: course.name,
			order: course.order,
			created_at: course.created_at?.toISOString() || null,
			user_code: course.user_code
		})) as unknown as Courses[];
	} catch (error) {
		console.error('Error fetching courses:', error);
		return [];
	}
}

export async function updateCourseOrder(courseCode: string, newOrder: number): Promise<boolean> {
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

export async function reorderCourse(
	courses: Courses[],
	courseCode: string,
	direction: 'up' | 'down'
): Promise<boolean> {
	try {
		// Find the current course and its index
		const currentIndex = courses.findIndex((c) => String(c.code) === courseCode);
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
			db
				.updateTable('courses')
				.set({ order: targetOrder })
				.where('code', '=', currentCourse.code)
				.execute(),
			db
				.updateTable('courses')
				.set({ order: currentOrder })
				.where('code', '=', targetCourse.code)
				.execute()
		]);

		return true;
	} catch {
		return false;
	}
}
