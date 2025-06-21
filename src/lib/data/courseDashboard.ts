import { db } from '$lib/database';
import { sql } from 'kysely';
import type { CourseScore, EvalScore } from '$lib/types';

export async function getCourseScores(
	levelCode: string,
	groupName: string
): Promise<CourseScore[] | null> {
	try {
		const result = await sql<CourseScore>`
			SELECT * FROM get_level_course_scores(${levelCode}, ${groupName})
		`.execute(db);

		if (!result.rows || !Array.isArray(result.rows)) {
			return null;
		}

		return result.rows;
	} catch (error) {
		console.error('Error fetching course scores:', error);
		return null;
	}
}

export async function getEvalScores(
	levelCode: string,
	courseCode: string,
	groupName: string
): Promise<EvalScore[] | null> {
	try {
		// Use the optimized SQL function
		const result = await sql<EvalScore>`
			SELECT * FROM get_course_eval_scores(${levelCode}, ${courseCode}, ${groupName})
		`.execute(db);

		if (!result.rows || !Array.isArray(result.rows)) {
			return [];
		}

		return result.rows;
	} catch (error) {
		console.error('Error fetching evaluation scores:', error);
		return null;
	}
}
