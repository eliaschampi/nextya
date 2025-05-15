import type { SupabaseClient } from '@supabase/supabase-js';
import type { EvalDashboardData, QuestionStat, ScoreDistribution } from '$lib/types/evalDashboard';

/**
 * Fetches dashboard data for a specific evaluation using the optimized SQL function
 * @param supabase Supabase client
 * @param evalCode Evaluation code to get dashboard data for
 * @returns Evaluation dashboard data for charts and visualizations
 */
export async function getEvalDashboardData(
	supabase: SupabaseClient,
	evalCode: string
): Promise<EvalDashboardData | null> {
	try {
		// Call the optimized SQL function
		const { data, error } = await supabase.rpc('get_eval_dashboard_data', {
			p_eval_code: evalCode
		});

		if (error) {
			console.error('Error fetching evaluation dashboard data:', error);
			return null;
		}

		if (!data || !Array.isArray(data) || data.length === 0) {
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
		data.forEach((item) => {
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
