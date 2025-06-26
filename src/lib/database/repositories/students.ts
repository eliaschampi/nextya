/**
 * STUDENTS REPOSITORY - Simplified Clean Architecture
 *
 * ARCHITECTURE PRINCIPLE: Direct, efficient, type-safe
 * Focused on student-specific business logic
 */

import { BaseRepository } from './base';
import type { DB } from '$lib/database/types';
import type { Selectable, Insertable, Updateable } from 'kysely';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type Student = Selectable<DB['students']>;
export type NewStudent = Insertable<DB['students']>;
export type StudentUpdate = Updateable<DB['students']>;

export interface StudentWithRegister extends Student {
	register_code: string;
	roll_code: string;
	group_name: string;
	level_code: string;
	level_name: string;
}

// ============================================================================
// STUDENTS REPOSITORY
// ============================================================================

export class StudentsRepository extends BaseRepository {
	constructor() {
		super('students');
	}

	/**
	 * Search students by name or last name
	 */
	async search(query: string): Promise<Student[]> {
		if (!query.trim()) return [];

		try {
			return await this.db
				.selectFrom('students')
				.selectAll()
				.where((eb) =>
					eb.or([eb('name', 'ilike', `%${query}%`), eb('last_name', 'ilike', `%${query}%`)])
				)
				.orderBy('name', 'asc')
				.execute();
		} catch (error) {
			this.logError('search', error);
			return [];
		}
	}

	/**
	 * Get students by level and group with register information
	 */
	async getByLevelAndGroup(levelCode: string, groupName: string): Promise<StudentWithRegister[]> {
		try {
			const result = await this.db
				.selectFrom('students')
				.innerJoin('registers', 'registers.student_code', 'students.code')
				.innerJoin('levels', 'levels.code', 'registers.level_code')
				.select([
					'students.code',
					'students.name',
					'students.last_name',
					'students.email',
					'students.phone',
					'students.created_at',
					'students.updated_at',
					'students.user_code',
					'registers.code as register_code',
					'registers.roll_code',
					'registers.group_name',
					'registers.level_code',
					'levels.name as level_name'
				])
				.where('registers.level_code', '=', levelCode)
				.where('registers.group_name', '=', groupName)
				.orderBy('students.name', 'asc')
				.execute();

			return result as StudentWithRegister[];
		} catch (error) {
			this.logError('getByLevelAndGroup', error);
			return [];
		}
	}

	/**
	 * Get student with all registers
	 */
	async getWithRegisters(studentCode: string) {
		try {
			const result = await this.db
				.selectFrom('students')
				.leftJoin('registers', 'registers.student_code', 'students.code')
				.leftJoin('levels', 'levels.code', 'registers.level_code')
				.select([
					'students.code',
					'students.name',
					'students.last_name',
					'students.email',
					'students.phone',
					'students.created_at',
					'students.updated_at',
					'students.user_code',
					'registers.code as register_code',
					'registers.roll_code',
					'registers.group_name',
					'registers.level_code',
					'levels.name as level_name'
				])
				.where('students.code', '=', studentCode)
				.execute();

			if (!result.length) return null;

			const student = result[0];
			const registers = result
				.filter((row: any) => row.register_code)
				.map((row: any) => ({
					code: row.register_code!,
					roll_code: row.roll_code!,
					group_name: row.group_name!,
					level_code: row.level_code!,
					level_name: row.level_name!
				}));

			return {
				...student,
				registers
			};
		} catch (error) {
			this.logError('getWithRegisters', error);
			return null;
		}
	}

	/**
	 * Get students by user
	 */
	async getByUser(userCode: string): Promise<Student[]> {
		try {
			return await this.db
				.selectFrom('students')
				.selectAll()
				.where('user_code', '=', userCode)
				.orderBy('name', 'asc')
				.execute();
		} catch (error) {
			this.logError('getByUser', error);
			return [];
		}
	}

	/**
	 * Check if email exists (for validation)
	 */
	async emailExists(email: string, excludeCode?: string): Promise<boolean> {
		try {
			let query = this.db.selectFrom('students').select('code').where('email', '=', email);

			if (excludeCode) {
				query = query.where('code', '!=', excludeCode);
			}

			const result = await query.limit(1).executeTakeFirst();
			return !!result;
		} catch (error) {
			this.logError('emailExists', error);
			return false;
		}
	}

	/**
	 * Get students with evaluation results
	 */
	async getWithResults(studentCode: string) {
		try {
			const result = await this.db
				.selectFrom('students')
				.innerJoin('registers', 'registers.student_code', 'students.code')
				.leftJoin('eval_results', 'eval_results.register_code', 'registers.code')
				.leftJoin('evals', 'evals.code', 'eval_results.eval_code')
				.select([
					'students.code',
					'students.name',
					'students.last_name',
					'students.email',
					'registers.code as register_code',
					'registers.level_code',
					'registers.group_name',
					'eval_results.score',
					'eval_results.calculated_at',
					'evals.name as eval_name',
					'evals.eval_date'
				])
				.where('students.code', '=', studentCode)
				.where('eval_results.section_code', 'is', null) // Only overall results
				.orderBy('evals.eval_date', 'desc')
				.execute();

			return result;
		} catch (error) {
			this.logError('getWithResults', error);
			return [];
		}
	}
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const studentsRepository = new StudentsRepository();
