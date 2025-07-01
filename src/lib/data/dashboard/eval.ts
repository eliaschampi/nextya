import { db } from '$lib/database';
import { sql } from 'kysely';
import type { EvalDashboardData, QuestionStat, ScoreDistribution } from '$lib/types/dashboard/eval';

export async function getEvalDashboardData(evalCode: string): Promise<EvalDashboardData | null> {
	try {
		// Call the optimized SQL function
		const result = await sql<{
			data_type: string;
			json_data: unknown;
		}>`SELECT * FROM get_eval_dashboard_data(${evalCode})`.execute(db);

		if (!result.rows || result.rows.length === 0) {
			console.error('No data returned from evaluation dashboard function');
			return null;
		}

		// Process the returned data
		const dashboardData: EvalDashboardData = {
			topCorrectQuestions: [],
			topIncorrectQuestions: [],
			scoreDistribution: {
				approved: 0,
				middle: 0,
				failed: 0,
				approvedCount: 0,
				middleCount: 0,
				failedCount: 0,
				totalCount: 0
			}
		};

		// Extract data from the response
		result.rows.forEach((item) => {
			if (item.data_type === 'topCorrectQuestions' && item.json_data) {
				dashboardData.topCorrectQuestions = item.json_data as QuestionStat[];
			} else if (item.data_type === 'topIncorrectQuestions' && item.json_data) {
				dashboardData.topIncorrectQuestions = item.json_data as QuestionStat[];
			} else if (item.data_type === 'scoreDistribution' && item.json_data) {
				dashboardData.scoreDistribution = item.json_data as ScoreDistribution;
			}
		});

		return dashboardData;
	} catch (error) {
		console.error('Error fetching evaluation dashboard data:', error);
		return null;
	}
}
