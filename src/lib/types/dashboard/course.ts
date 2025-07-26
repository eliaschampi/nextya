/**
 * Types for the course dashboard
 */

/**
 * Represents course score data from the database
 */
export interface CourseScore {
	course_code: string;
	course_name: string;
	average_score: number;
}

/**
 * Represents evaluation score data for a specific course
 */
export interface EvalScore {
	eval_code: string;
	eval_name: string;
	eval_date: string;
	average_score: number;
}

/**
 * Represents chart data for course scores
 */
export interface CourseChartData {
	labels: string[];
	values: number[];
}

/**
 * Represents chart data for evaluation scores
 */
export interface EvalChartData {
	labels: string[];
	values: number[];
}

/**
 * Represents score distribution data for a course
 */
export interface CourseScoreDistribution {
	approved: number; // Percentage of students with score >= 14
	middle: number; // Percentage of students with score between 10 and 14
	failed: number; // Percentage of students with score < 10
	approvedCount: number;
	middleCount: number;
	failedCount: number;
	totalCount: number;
}
