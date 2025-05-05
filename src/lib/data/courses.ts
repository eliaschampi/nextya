import type { SupabaseClient } from '@supabase/supabase-js';
import type { Course } from '$lib/types';

export async function getCourses(supabase: SupabaseClient) {
	const { data: courses, error } = await supabase
		.from('courses')
		.select('*')
		.order('order', { ascending: true });
	return error ? [] : courses;
}

/**
 * Updates the order of a course
 * @param supabase Supabase client
 * @param courseCode Course code to update
 * @param newOrder New order value
 * @returns True if successful, false otherwise
 */
export async function updateCourseOrder(
	supabase: SupabaseClient,
	courseCode: string,
	newOrder: number
): Promise<boolean> {
	const { error } = await supabase
		.from('courses')
		.update({ order: newOrder })
		.eq('code', courseCode);

	return !error;
}

/**
 * Reorders courses when moving a course up or down
 * @param supabase Supabase client
 * @param courses List of all courses
 * @param courseCode Course code to move
 * @param direction 'up' or 'down'
 * @returns True if successful, false otherwise
 */
export async function reorderCourse(
	supabase: SupabaseClient,
	courses: Course[],
	courseCode: string,
	direction: 'up' | 'down'
): Promise<boolean> {
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

	// Update both courses
	const updates = [
		supabase.from('courses').update({ order: targetOrder }).eq('code', currentCourse.code),
		supabase.from('courses').update({ order: currentOrder }).eq('code', targetCourse.code)
	];

	// Execute all updates
	const results = await Promise.all(updates);

	// Check if any errors occurred
	return !results.some((result) => result.error);
}
