import type { SupabaseClient } from '@supabase/supabase-js';
import type {
	StudentRegisterResult,
	GroupData,
	EvalChartData,
	GroupChartData,
	AnswerDistribution,
	StudentPerformance,
	LevelDashboardData,
	GroupDashboardData
} from '$lib/types/dashboard';

/**
 * Fetches and processes dashboard data for a specific level
 * @param supabase Supabase client
 * @param levelCode Level code to get dashboard data for
 * @returns Level dashboard data for charts and visualizations
 */
export async function getLevelDashboardData(
	supabase: SupabaseClient,
	levelCode: string
): Promise<LevelDashboardData | null> {
	try {
		// Run queries for student results and groups in parallel
		const [evalResultsResponse, groupsResponse] = await Promise.all([
			// Get evaluation results for the level
			supabase
				.from('student_register_results')
				.select('*')
				.eq('level_code', levelCode)
				.order('eval_date', { ascending: true }),

			// Get groups for the level
			supabase
				.from('registers')
				.select('group_name')
				.eq('level_code', levelCode)
				.order('group_name')
		]);

		// Check for errors in any of the queries
		if (evalResultsResponse.error) {
			console.error('Error fetching evaluation results:', evalResultsResponse.error);
			return null;
		}

		if (groupsResponse.error) {
			console.error('Error fetching groups:', groupsResponse.error);
			return null;
		}

		// Extract data from responses
		const evalResults = evalResultsResponse.data || [];
		const groups = groupsResponse.data || [];

		// Filter to get unique group names
		const uniqueGroups = Array.from(new Set(groups.map((g) => g.group_name))).map((groupName) => ({
			group_name: groupName
		}));

		// Process data for charts
		const scoresByGroup = processScoresByGroup(evalResults, uniqueGroups);
		const correctVsIncorrect = processCorrectVsIncorrect(evalResults);

		// Prepare response data
		return {
			scoresByGroup,
			correctVsIncorrect
		};
	} catch (error) {
		console.error('Error fetching level dashboard data:', error);
		return null;
	}
}

/**
 * Fetches and processes dashboard data for a specific level and group
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
		// Get evaluation results for the level and group
		const { data: evalResults, error } = await supabase
			.from('student_register_results')
			.select('*')
			.eq('level_code', levelCode)
			.eq('register_group_name', groupName)
			.order('eval_date', { ascending: true });

		if (error) {
			console.error('Error fetching evaluation results:', error);
			return null;
		}

		// Process data for charts
		const scoresByEval = processScoresByEval(evalResults || []);
		const studentPerformance = processStudentPerformance(evalResults || []);

		// Prepare response data
		return {
			scoresByEval,
			studentPerformance
		};
	} catch (error) {
		console.error('Error fetching group dashboard data:', error);
		return null;
	}
}

/**
 * Process data for average scores by evaluation
 * @param results The evaluation results
 */
function processScoresByEval(results: StudentRegisterResult[]): EvalChartData[] {
	if (!results || !Array.isArray(results) || results.length === 0) {
		return [];
	}

	// Results are already filtered by group in the query
	const evalMap = new Map();

	results.forEach((result) => {
		if (!result.eval_code || !result.eval_name || result.score === null) return;

		if (!evalMap.has(result.eval_code)) {
			evalMap.set(result.eval_code, {
				name: result.eval_name,
				date: result.eval_date || new Date().toISOString(),
				totalScore: result.score,
				count: 1
			});
		} else {
			const evalData = evalMap.get(result.eval_code);
			evalData.totalScore += result.score;
			evalData.count += 1;
		}
	});

	if (evalMap.size === 0) {
		return [];
	}

	try {
		return Array.from(evalMap.entries())
			.map(([, data]) => ({
				name: data.name,
				averageScore: parseFloat((data.totalScore / data.count).toFixed(2))
			}))
			.sort((a, b) => {
				// Sort by name as a fallback
				return a.name.localeCompare(b.name);
			});
	} catch (error) {
		console.error('Error processing eval data:', error);
		return [];
	}
}

/**
 * Process data for average scores by group
 */
function processScoresByGroup(
	results: StudentRegisterResult[],
	groups: GroupData[]
): GroupChartData[] {
	if (
		!results ||
		!Array.isArray(results) ||
		results.length === 0 ||
		!groups ||
		!Array.isArray(groups) ||
		groups.length === 0
	) {
		return [];
	}

	const groupMap = new Map();

	// Initialize groups
	try {
		groups.forEach((group) => {
			if (group && group.group_name) {
				groupMap.set(group.group_name, {
					totalScore: 0,
					count: 0
				});
			}
		});

		// Aggregate scores by group
		results.forEach((result) => {
			if (!result.register_group_name || result.score === null) return;

			if (groupMap.has(result.register_group_name)) {
				const groupData = groupMap.get(result.register_group_name);
				groupData.totalScore += result.score;
				groupData.count += 1;
			}
		});

		if (groupMap.size === 0) {
			return [];
		}

		// Calculate averages
		return Array.from(groupMap.entries())
			.map(([group, data]) => ({
				group,
				averageScore: data.count > 0 ? parseFloat((data.totalScore / data.count).toFixed(2)) : 0
			}))
			.sort((a, b) => a.group.localeCompare(b.group));
	} catch (error) {
		console.error('Error processing group data:', error);
		return [];
	}
}

/**
 * Process data for correct vs incorrect answers
 */
function processCorrectVsIncorrect(results: StudentRegisterResult[]): AnswerDistribution {
	if (!results || !Array.isArray(results) || results.length === 0) {
		return { correct: 0, incorrect: 0, blank: 0 };
	}

	let totalCorrect = 0;
	let totalIncorrect = 0;
	let totalBlank = 0;

	try {
		results.forEach((result) => {
			if (result.correct_count !== null && result.correct_count !== undefined) {
				totalCorrect += result.correct_count;
			}
			if (result.incorrect_count !== null && result.incorrect_count !== undefined) {
				totalIncorrect += result.incorrect_count;
			}
			if (result.blank_count !== null && result.blank_count !== undefined) {
				totalBlank += result.blank_count;
			}
		});

		return {
			correct: totalCorrect,
			incorrect: totalIncorrect,
			blank: totalBlank
		};
	} catch (error) {
		console.error('Error processing correct vs incorrect data:', error);
		return { correct: 0, incorrect: 0, blank: 0 };
	}
}

/**
 * Process data for student performance
 */
function processStudentPerformance(results: StudentRegisterResult[]): StudentPerformance[] {
	if (!results || !Array.isArray(results) || results.length === 0) {
		return [];
	}

	const studentMap = new Map();

	try {
		// Group results by student
		results.forEach((result) => {
			if (
				!result.student_code ||
				result.score === null ||
				result.student_name === null ||
				result.student_last_name === null
			)
				return;

			const fullName = `${result.student_name} ${result.student_last_name}`;

			if (!studentMap.has(result.student_code)) {
				studentMap.set(result.student_code, {
					name: fullName,
					totalScore: result.score,
					count: 1
				});
			} else {
				const studentData = studentMap.get(result.student_code);
				studentData.totalScore += result.score;
				studentData.count += 1;
			}
		});

		if (studentMap.size === 0) {
			return [];
		}

		return Array.from(studentMap.entries())
			.map(([, data]) => ({
				name: data.name || 'Estudiante sin nombre',
				averageScore: parseFloat((data.totalScore / data.count).toFixed(2))
			}))
			.sort((a, b) => b.averageScore - a.averageScore)
			.slice(0, 10); // Get top 10 students
	} catch (error) {
		console.error('Error processing student performance data:', error);
		return [];
	}
}
