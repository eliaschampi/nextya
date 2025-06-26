/**
 * COURSES REPOSITORY - Simplified Clean Architecture
 *
 * ARCHITECTURE PRINCIPLE: Direct, efficient, type-safe
 * Focused on course-specific business logic
 */

import { BaseRepository } from './base';
import type { DB } from '$lib/database/types';
import type { Selectable, Insertable, Updateable } from 'kysely';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type Course = Selectable<DB['courses']>;
export type NewCourse = Insertable<DB['courses']>;
export type CourseUpdate = Updateable<DB['courses']>;

// ============================================================================
// COURSES REPOSITORY
// ============================================================================

export class CoursesRepository extends BaseRepository {
	constructor() {
		super('courses');
	}

	/**
	 * Get all courses ordered by their display order
	 */
	async getAllOrdered(): Promise<Course[]> {
		try {
			return await this.db.selectFrom('courses').selectAll().orderBy('order', 'asc').execute();
		} catch (error) {
			this.logError('getAllOrdered', error);
			return [];
		}
	}

	/**
	 * Get courses by user
	 */
	async getByUser(userCode: string): Promise<Course[]> {
		try {
			return await this.db
				.selectFrom('courses')
				.selectAll()
				.where('user_code', '=', userCode)
				.orderBy('order', 'asc')
				.execute();
		} catch (error) {
			this.logError('getByUser', error);
			return [];
		}
	}

	/**
	 * Update course order efficiently
	 */
	async updateOrder(courseCode: string, newOrder: number): Promise<boolean> {
		try {
			await this.db
				.updateTable('courses')
				.set({ order: newOrder })
				.where('code', '=', courseCode)
				.execute();
			return true;
		} catch (error) {
			this.logError('updateOrder', error);
			return false;
		}
	}

	/**
	 * Reorder course (move up/down)
	 */
	async reorder(courseCode: string, direction: 'up' | 'down'): Promise<boolean> {
		try {
			// Get all courses to calculate new positions
			const courses = await this.getAllOrdered();
			const currentIndex = courses.findIndex((c) => c.code === courseCode);

			if (currentIndex === -1) return false;

			const targetIndex =
				direction === 'up'
					? Math.max(0, currentIndex - 1)
					: Math.min(courses.length - 1, currentIndex + 1);

			if (targetIndex === currentIndex) return true;

			const currentCourse = courses[currentIndex];
			const targetCourse = courses[targetIndex];

			// Swap orders atomically
			await Promise.all([
				this.updateOrder(currentCourse.code, targetCourse.order),
				this.updateOrder(targetCourse.code, currentCourse.order)
			]);

			return true;
		} catch (error) {
			this.logError('reorder', error);
			return false;
		}
	}

	/**
	 * Get course with evaluation sections
	 */
	async getWithSections(courseCode: string) {
		try {
			const result = await this.db
				.selectFrom('courses')
				.leftJoin('eval_sections', 'eval_sections.course_code', 'courses.code')
				.select([
					'courses.code',
					'courses.name',
					'courses.abr',
					'courses.order',
					'courses.user_code',
					'courses.created_at',
					'eval_sections.code as section_code',
					'eval_sections.eval_code',
					'eval_sections.order_in_eval',
					'eval_sections.question_count'
				])
				.where('courses.code', '=', courseCode)
				.execute();

			if (!result.length) return null;

			const course = result[0];
			const sections = result
				.filter((row) => row.section_code)
				.map((row) => ({
					code: row.section_code!,
					eval_code: row.eval_code!,
					course_code: courseCode,
					order_in_eval: row.order_in_eval!,
					question_count: row.question_count!
				}));

			return {
				...course,
				sections
			};
		} catch (error) {
			this.logError('getWithSections', error);
			return null;
		}
	}

	/**
	 * Search courses by name or abbreviation
	 */
	async search(query: string): Promise<Course[]> {
		try {
			return await this.db
				.selectFrom('courses')
				.selectAll()
				.where((eb) => eb.or([eb('name', 'ilike', `%${query}%`), eb('abr', 'ilike', `%${query}%`)]))
				.orderBy('order', 'asc')
				.execute();
		} catch (error) {
			this.logError('search', error);
			return [];
		}
	}

	/**
	 * Get next available order number
	 */
	async getNextOrder(): Promise<number> {
		try {
			const result = await this.db
				.selectFrom('courses')
				.select(this.db.fn.max('order').as('max_order'))
				.executeTakeFirst();

			return (result?.max_order || 0) + 1;
		} catch (error) {
			this.logError('getNextOrder', error);
			return 1;
		}
	}
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const coursesRepository = new CoursesRepository();
