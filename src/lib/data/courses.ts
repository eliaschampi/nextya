/**
 * COURSES DATA LAYER - Modern Clean Architecture
 *
 * ARCHITECTURE PRINCIPLE: Use repository pattern for clean separation
 * Delegates to CoursesRepository for all database operations
 */

import { coursesRepository } from '$lib/database/repositories';
import type { Courses } from '$lib/types';

/**
 * Get all courses ordered by display order
 */
export async function getCourses(): Promise<Courses[]> {
	return coursesRepository.getAllOrdered();
}

/**
 * Update course order
 */
export async function updateCourseOrder(courseCode: string, newOrder: number): Promise<boolean> {
	return coursesRepository.updateOrder(courseCode, newOrder);
}

/**
 * Reorder course (move up/down)
 */
export async function reorderCourse(
	courses: Courses[],
	courseCode: string,
	direction: 'up' | 'down'
): Promise<boolean> {
	return coursesRepository.reorder(courseCode, direction);
}
