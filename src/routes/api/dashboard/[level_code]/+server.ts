import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type {
	StudentRegisterResult,
	GroupData,
	EvalChartData,
	GroupChartData,
	CourseChartData,
	AnswerDistribution,
	StudentPerformance,
	DashboardData
} from '$lib/types/dashboard';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { level_code } = params;

	if (!level_code) {
		return json({ error: 'Código de nivel no proporcionado' }, { status: 400 });
	}

	try {
		// Run queries for student results, groups, and evaluations in parallel
		const [evalResultsResponse, groupsResponse, evalsResponse] = await Promise.all([
			// Get evaluation results for the level
			locals.supabase
				.from('student_register_results')
				.select('*')
				.eq('level_code', level_code)
				.order('eval_date', { ascending: true }),

			// Get groups for the level
			locals.supabase
				.from('registers')
				.select('group_name')
				.eq('level_code', level_code)
				.order('group_name'),

			// Get evaluations for the level
			locals.supabase
				.from('evals')
				.select('code, name, eval_date')
				.eq('level_code', level_code)
				.order('eval_date', { ascending: true })
		]);

		// Check for errors in any of the queries
		if (evalResultsResponse.error) {
			return json({ error: 'Error al obtener resultados de evaluaciones' }, { status: 500 });
		}

		if (groupsResponse.error) {
			return json({ error: 'Error al obtener grupos' }, { status: 500 });
		}

		if (evalsResponse.error) {
			return json({ error: 'Error al obtener evaluaciones' }, { status: 500 });
		}

		// Extract data from responses
		const evalResults = evalResultsResponse.data || [];
		const groups = groupsResponse.data || [];
		const evals = evalsResponse.data || [];

		// Filter to get unique group names
		const uniqueGroups = Array.from(new Set(groups.map((g) => g.group_name))).map((groupName) => ({
			group_name: groupName
		}));

		// Process data for charts
		const scoresByEval = processScoresByEval(evalResults);
		const scoresByGroup = processScoresByGroup(evalResults, uniqueGroups);
		const correctVsIncorrect = processCorrectVsIncorrect(evalResults);
		const studentPerformance = processStudentPerformance(evalResults);

		// Process course scores from the evaluation results
		const scoresByCourse = processScoresByCourse(evalResults);

		// Prepare and return response data
		const responseData: DashboardData = {
			scoresByEval,
			scoresByGroup,
			scoresByCourse,
			correctVsIncorrect,
			studentPerformance,
			evaluations: evals,
			groups: uniqueGroups.map((g: GroupData) => g.group_name)
		};

		return json(responseData);
	} catch (error) {
		console.error('Unexpected error:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};

// Process data for average scores by evaluation
function processScoresByEval(results: StudentRegisterResult[]): EvalChartData[] {
	if (!results || !Array.isArray(results) || results.length === 0) {
		return [];
	}

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
			.map(([code, data]) => ({
				code,
				name: data.name,
				date: data.date,
				averageScore: parseFloat((data.totalScore / data.count).toFixed(2))
			}))
			.sort((a, b) => {
				// Handle invalid dates
				const dateA = new Date(a.date || 0).getTime();
				const dateB = new Date(b.date || 0).getTime();
				return dateA - dateB;
			});
	} catch (error) {
		console.error('Error processing eval data:', error);
		return [];
	}
}

// Process data for average scores by group
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

// Process data for correct vs incorrect answers
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

// Process data for top student performance
function processStudentPerformance(results: StudentRegisterResult[]): StudentPerformance[] {
	if (!results || !Array.isArray(results) || results.length === 0) {
		return [];
	}

	const studentMap = new Map();

	try {
		results.forEach((result) => {
			if (!result.student_code || !result.student_name || result.score === null) return;

			const studentKey = `${result.student_code}`;

			if (!studentMap.has(studentKey)) {
				studentMap.set(studentKey, {
					name: `${result.student_name} ${result.student_last_name || ''}`.trim(),
					totalScore: result.score,
					count: 1
				});
			} else {
				const studentData = studentMap.get(studentKey);
				studentData.totalScore += result.score;
				studentData.count += 1;
			}
		});

		if (studentMap.size === 0) {
			return [];
		}

		return Array.from(studentMap.entries())
			.map(([code, data]) => ({
				code,
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

// Process data for scores by course
function processScoresByCourse(results: StudentRegisterResult[]): CourseChartData[] {
	if (!results || !Array.isArray(results) || results.length === 0) {
		return [];
	}

	// Extract course information from the results
	// This is a simplified approach since we don't have direct course data in the results
	// In a real implementation, you might want to use a database view or function
	const courseMap = new Map();

	try {
		// Group results by section (which corresponds to courses)
		results.forEach((result) => {
			// Use section information if available
			if (result.section_code && result.section_name && result.score !== null) {
				if (!courseMap.has(result.section_code)) {
					courseMap.set(result.section_code, {
						name: result.section_name,
						totalScore: result.score,
						count: 1
					});
				} else {
					const courseData = courseMap.get(result.section_code);
					courseData.totalScore += result.score;
					courseData.count += 1;
				}
			}
		});

		if (courseMap.size === 0) {
			return [];
		}

		return Array.from(courseMap.entries())
			.map(([code, data]) => ({
				code,
				name: data.name || 'Curso sin nombre',
				averageScore: parseFloat((data.totalScore / data.count).toFixed(2))
			}))
			.sort((a, b) => b.averageScore - a.averageScore);
	} catch (error) {
		console.error('Error processing course data:', error);
		return [];
	}
}
