import { sql } from 'kysely';
import type { Database } from '$lib/database';
import type { StudentRanking, RankingFilters } from '$lib/types/dashboard/ranking';

/**
 * Get student ranking with optional filters
 */
export async function getStudentRanking(
	db: Database,
	filters: RankingFilters = {}
): Promise<StudentRanking[]> {
	try {
		const { level_code, group_name } = filters;

		const result = await sql<StudentRanking>`
			SELECT * FROM get_student_ranking(
				${level_code ? sql`${level_code}::UUID` : sql`NULL`},
				${group_name ? sql`${group_name}::CHAR(1)` : sql`NULL`}
			)
		`.execute(db);

		return result.rows || [];
	} catch (error) {
		console.error('Error fetching student ranking:', error);
		return [];
	}
}

/**
 * Get available groups for a specific level
 */
export async function getAvailableGroups(db: Database, level_code: string): Promise<string[]> {
	try {
		const result = await db
			.selectFrom('registers')
			.select('group_name')
			.where('level_code', '=', level_code)
			.distinct()
			.orderBy('group_name')
			.execute();

		return result.map((row) => row.group_name);
	} catch (error) {
		console.error('Error fetching available groups:', error);
		return [];
	}
}
