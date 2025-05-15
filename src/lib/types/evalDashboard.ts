/**
 * Types for the evaluation dashboard
 */

/**
 * Represents a question with its statistics for the dashboard
 */
export interface QuestionStat {
	questionCode: string;
	orderInEval: number;
	courseName: string;
	correctCount?: number;
	incorrectCount?: number;
	totalAnswers: number;
	correctPercentage?: number;
	incorrectPercentage?: number;
}

/**
 * Represents the score distribution for an evaluation
 */
export interface ScoreDistribution {
	approved: number; // Percentage of students with score >= 14
	middle: number; // Percentage of students with score between 10 and 14
	failed: number; // Percentage of students with score < 10
	approvedCount: number;
	middleCount: number;
	failedCount: number;
	totalCount: number;
}

/**
 * Represents the complete evaluation dashboard data
 */
export interface EvalDashboardData {
	topCorrectQuestions: QuestionStat[];
	topIncorrectQuestions: QuestionStat[];
	scoreDistribution: ScoreDistribution;
}
