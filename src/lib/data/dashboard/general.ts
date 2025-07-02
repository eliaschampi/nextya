import { sql } from 'kysely';
import type { Database } from '$lib/database';
import type {
	EvalChartData,
	GroupChartData,
	AnswerDistribution,
	StudentPerformance,
	LevelDashboardData,
	GroupDashboardData
} from '$lib/types/dashboard';

export async function getLevelDashboardData(
	db: Database,
	levelCode: string
): Promise<LevelDashboardData | null> {
	try {
		// Call the optimized SQL function using raw SQL
		const result = await sql<{
			data_type: string;
			json_data: unknown;
		}>`SELECT * FROM get_level_dashboard_data(${levelCode})`.execute(db);

		if (!result.rows || result.rows.length === 0) {
			return null;
		}

		// Process the returned data
		const dashboardData: LevelDashboardData = {
			scoresByGroup: [],
			correctVsIncorrect: { correct: 0, incorrect: 0, blank: 0 }
		};

		// Extract data from the response
		result.rows.forEach((item) => {
			if (item.data_type === 'correctVsIncorrect' && item.json_data) {
				dashboardData.correctVsIncorrect = item.json_data as AnswerDistribution;
			} else if (item.data_type === 'scoresByGroup' && item.json_data) {
				dashboardData.scoresByGroup = item.json_data as GroupChartData[];
			}
		});

		return dashboardData;
	} catch {
		return null;
	}
}

export async function getGroupDashboardData(
	db: Database,
	levelCode: string,
	groupName: string
): Promise<GroupDashboardData | null> {
	try {
		// Call the optimized SQL function using raw SQL
		const result = await sql<{
			data_type: string;
			json_data: unknown;
		}>`SELECT * FROM get_group_dashboard_data(${levelCode}, ${groupName})`.execute(db);

		if (!result.rows || result.rows.length === 0) {
			return null;
		}

		// Process the returned data
		const dashboardData: GroupDashboardData = {
			scoresByEval: [],
			studentPerformance: []
		};

		// Extract data from the response
		result.rows.forEach((item) => {
			if (item.data_type === 'scoresByEval' && item.json_data) {
				dashboardData.scoresByEval = item.json_data as EvalChartData[];
			} else if (item.data_type === 'studentPerformance' && item.json_data) {
				dashboardData.studentPerformance = item.json_data as StudentPerformance[];
			}
		});

		return dashboardData;
	} catch {
		return null;
	}
}
