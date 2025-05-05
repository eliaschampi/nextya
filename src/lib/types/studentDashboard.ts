/**
 * Types for the student dashboard
 */

/**
 * Represents score evolution data for a student
 */
export interface StudentScoreEvolution {
	eval_code: string;
	eval_name: string;
	eval_date: string;
	score: number;
}

/**
 * Represents course score data for a student
 */
export interface StudentCourseScore {
	course_code: string;
	course_name: string;
	average_score: number;
}

/**
 * Represents chart data for score evolution
 */
export interface ScoreEvolutionChartData {
	labels: string[];
	values: number[];
}

/**
 * Represents chart data for course scores
 */
export interface CourseScoreChartData {
	labels: string[];
	values: number[];
}
