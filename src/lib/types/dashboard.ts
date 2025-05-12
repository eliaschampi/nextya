/**
 * Types for the dashboard
 */

/**
 * Represents evaluation data for charts
 */
export interface EvalChartData {
	name: string;
	averageScore: number;
}

/**
 * Represents group data for charts
 */
export interface GroupChartData {
	group: string;
	averageScore: number;
}

/**
 * Represents answer distribution data
 */
export interface AnswerDistribution {
	correct: number;
	incorrect: number;
	blank: number;
}

/**
 * Represents student performance data
 */
export interface StudentPerformance {
	name: string;
	averageScore: number;
}

/**
 * Represents level dashboard data
 */
export interface LevelDashboardData {
	scoresByGroup: GroupChartData[];
	correctVsIncorrect: AnswerDistribution;
}

/**
 * Represents group dashboard data
 */
export interface GroupDashboardData {
	scoresByEval: EvalChartData[];
	studentPerformance: StudentPerformance[];
}

/**
 * Represents a student register result from the database
 */
export interface StudentRegisterResult {
	result_code?: string | null;
	register_code?: string | null;
	eval_code?: string | null;
	eval_name?: string | null;
	eval_date?: string | null;
	register_group_name?: string | null;
	student_code?: string | null;
	student_name?: string | null;
	student_last_name?: string | null;
	correct_count?: number | null;
	incorrect_count?: number | null;
	blank_count?: number | null;
	score?: number | null;
	section_code?: string | null;
	section_name?: string | null;
	course_code?: string | null;
	course_name?: string | null;
	[key: string]: string | number | null | undefined; // For other properties that might be in the database
}

/**
 * Represents a group from the database
 */
export interface GroupData {
	group_name: string;
	[key: string]: string | number | null | undefined; // For other properties that might be in the database
}
