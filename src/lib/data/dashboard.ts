import type { SupabaseClient } from '@supabase/supabase-js';
import type {
	EvalChartData,
	GroupChartData,
	AnswerDistribution,
	StudentPerformance,
	LevelDashboardData,
	GroupDashboardData
} from '$lib/types/dashboard';

/**
 * Fetches dashboard data for a specific level using the optimized SQL function
 * @param supabase Supabase client
 * @param levelCode Level code to get dashboard data for
 * @returns Level dashboard data for charts and visualizations
 */
export async function getLevelDashboardData(
	supabase: SupabaseClient,
	levelCode: string
): Promise<LevelDashboardData | null> {
	try {
		// Call the optimized SQL function
		const { data, error } = await supabase.rpc('get_level_dashboard_data', {
			p_level_code: levelCode
		});

		if (error) {
			console.error('Error fetching level dashboard data:', error);
			return null;
		}

		if (!data || !Array.isArray(data) || data.length === 0) {
			console.error('No data returned from level dashboard function');
			return null;
		}

		// Process the returned data
		const dashboardData: LevelDashboardData = {
			scoresByGroup: [],
			correctVsIncorrect: { correct: 0, incorrect: 0, blank: 0 }
		};

		// Extract data from the response
		data.forEach((item) => {
			if (item.data_type === 'correctVsIncorrect' && item.json_data) {
				dashboardData.correctVsIncorrect = item.json_data as AnswerDistribution;
			} else if (item.data_type === 'scoresByGroup' && item.json_data) {
				dashboardData.scoresByGroup = item.json_data as GroupChartData[];
			}
		});

		return dashboardData;
	} catch (error) {
		console.error('Error fetching level dashboard data:', error);
		return null;
	}
}

/**
 * Fetches dashboard data for a specific level and group using the optimized SQL function
 * @param supabase Supabase client
 * @param levelCode Level code to get dashboard data for
 * @param groupName Group name to filter by
 * @returns Group dashboard data for charts and visualizations
 */
export async function getGroupDashboardData(
	supabase: SupabaseClient,
	levelCode: string,
	groupName: string
): Promise<GroupDashboardData | null> {
	try {
		// Call the optimized SQL function
		const { data, error } = await supabase.rpc('get_group_dashboard_data', {
			p_level_code: levelCode,
			p_group_name: groupName
		});

		if (error) {
			console.error('Error fetching group dashboard data:', error);
			return null;
		}

		if (!data || !Array.isArray(data) || data.length === 0) {
			console.error('No data returned from group dashboard function');
			return null;
		}

		// Process the returned data
		const dashboardData: GroupDashboardData = {
			scoresByEval: [],
			studentPerformance: []
		};

		// Extract data from the response
		data.forEach((item) => {
			if (item.data_type === 'scoresByEval' && item.json_data) {
				dashboardData.scoresByEval = item.json_data as EvalChartData[];
			} else if (item.data_type === 'studentPerformance' && item.json_data) {
				dashboardData.studentPerformance = item.json_data as StudentPerformance[];
			}
		});

		return dashboardData;
	} catch (error) {
		console.error('Error fetching group dashboard data:', error);
		return null;
	}
}
