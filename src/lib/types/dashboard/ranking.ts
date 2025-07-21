/**
 * Types for the student ranking dashboard
 */

/**
 * Represents a student in the ranking table
 */
export interface StudentRanking {
	roll_code: string;
	name: string;
	last_name: string;
	average_score: string; // NUMERIC from database comes as string
	total_evaluations: number;
}

/**
 * Represents ranking filter options
 */
export interface RankingFilters {
	level_code?: string;
	group_name?: string;
}
