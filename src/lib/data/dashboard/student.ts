import { sql } from 'kysely';
import type { Database } from '$lib/database';
import type { StudentScoreEvolution, StudentCourseScore, StudentCourseEvolution } from '$lib/types';

export async function getStudentScoreEvolution(
	db: Database,
	studentCode: string
): Promise<StudentScoreEvolution[] | null> {
	try {
		const result = await sql<StudentScoreEvolution>`
			SELECT * FROM get_student_score_evolution(${studentCode})
		`.execute(db);

		if (!result.rows || !Array.isArray(result.rows)) {
			return null;
		}

		return result.rows;
	} catch (error) {
		console.error('Error fetching student score evolution:', error);
		return null;
	}
}

export async function getStudentCourseScores(
	db: Database,
	studentCode: string
): Promise<StudentCourseScore[] | null> {
	try {
		const result = await sql<StudentCourseScore>`
			SELECT * FROM get_student_course_scores(${studentCode})
		`.execute(db);

		if (!result.rows || !Array.isArray(result.rows)) {
			return null;
		}

		return result.rows;
	} catch (error) {
		console.error('Error fetching student course scores:', error);
		return null;
	}
}

export async function getStudentCourseEvolution(
	db: Database,
	studentCode: string
): Promise<StudentCourseEvolution[] | null> {
	try {
		const result = await sql<StudentCourseEvolution>`
			SELECT * FROM get_student_course_evolution(${studentCode})
		`.execute(db);

		if (!result.rows || !Array.isArray(result.rows)) {
			return null;
		}

		return result.rows;
	} catch (error) {
		console.error('Error fetching student course evolution:', error);
		return null;
	}
}
