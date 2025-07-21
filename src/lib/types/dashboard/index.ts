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
}

/**
 * Represents a group from the database
 */
export interface GroupData {
	group_name: string;
	[key: string]: string | number | null | undefined; // For other properties that might be in the database
}
