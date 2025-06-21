/**
 * Type transformation utilities for converting between Kysely database types and clean frontend types
 * This ensures type safety while keeping the frontend code clean and free of ColumnType wrappers
 */

import type { DB } from '$lib/database/types';
import type * as FrontendTypes from '$lib/types/core';
import type { Selectable } from 'kysely';

// Kysely query result types (what we get from .execute())
type SelectableCourse = Selectable<DB['courses']>;
type SelectableStudent = Selectable<DB['students']>;
type SelectableUser = Selectable<DB['users']>;
type SelectableLevel = Selectable<DB['levels']>;
type SelectableEval = Selectable<DB['evals']>;
type SelectableEvalSection = Selectable<DB['eval_sections']>;
type SelectableEvalQuestion = Selectable<DB['eval_questions']>;
type SelectableEvalAnswer = Selectable<DB['eval_answers']>;
type SelectableEvalResult = Selectable<DB['eval_results']>;
type SelectableRegister = Selectable<DB['registers']>;
type SelectablePermission = Selectable<DB['permissions']>;

/**
 * Transform database Users to frontend Users
 */
export function transformUser(dbUser: SelectableUser): FrontendTypes.Users {
	return {
		code: dbUser.code,
		created_at: dbUser.created_at,
		email: dbUser.email,
		is_email_verified: dbUser.is_email_verified,
		is_super_admin: dbUser.is_super_admin,
		last_login: dbUser.last_login,
		last_name: dbUser.last_name,
		name: dbUser.name,
		password_hash: dbUser.password_hash,
		photo_url: dbUser.photo_url,
		updated_at: dbUser.updated_at
	};
}

/**
 * Transform database Students to frontend Students
 */
export function transformStudent(dbStudent: SelectableStudent): FrontendTypes.Students {
	return {
		code: dbStudent.code,
		created_at: dbStudent.created_at,
		email: dbStudent.email,
		last_name: dbStudent.last_name,
		name: dbStudent.name,
		phone: dbStudent.phone,
		updated_at: dbStudent.updated_at,
		user_code: dbStudent.user_code
	};
}

/**
 * Transform database Courses to frontend Courses
 */
export function transformCourse(dbCourse: SelectableCourse): FrontendTypes.Courses {
	return {
		abr: dbCourse.abr,
		code: dbCourse.code,
		created_at: dbCourse.created_at,
		name: dbCourse.name,
		order: dbCourse.order,
		user_code: dbCourse.user_code
	};
}

/**
 * Transform database Levels to frontend Levels
 */
export function transformLevel(dbLevel: SelectableLevel): FrontendTypes.Levels {
	return {
		abr: dbLevel.abr,
		code: dbLevel.code,
		created_at: dbLevel.created_at,
		name: dbLevel.name,
		users: dbLevel.users
	};
}

/**
 * Transform database Evals to frontend Evals
 */
export function transformEval(dbEval: SelectableEval): FrontendTypes.Evals {
	return {
		code: dbEval.code,
		created_at: dbEval.created_at,
		eval_date: dbEval.eval_date,
		group_name: dbEval.group_name,
		level_code: dbEval.level_code,
		name: dbEval.name,
		updated_at: dbEval.updated_at,
		user_code: dbEval.user_code
	};
}

/**
 * Transform database EvalSections to frontend EvalSections
 */
export function transformEvalSection(
	dbEvalSection: SelectableEvalSection
): FrontendTypes.EvalSections {
	return {
		code: dbEvalSection.code,
		course_code: dbEvalSection.course_code,
		eval_code: dbEvalSection.eval_code,
		order_in_eval: dbEvalSection.order_in_eval,
		question_count: dbEvalSection.question_count
	};
}

/**
 * Transform database EvalQuestions to frontend EvalQuestions
 */
export function transformEvalQuestion(
	dbEvalQuestion: SelectableEvalQuestion
): FrontendTypes.EvalQuestions {
	return {
		code: dbEvalQuestion.code,
		correct_key: dbEvalQuestion.correct_key,
		eval_code: dbEvalQuestion.eval_code,
		omitable: dbEvalQuestion.omitable,
		order_in_eval: dbEvalQuestion.order_in_eval,
		score_percent:
			typeof dbEvalQuestion.score_percent === 'string'
				? parseFloat(dbEvalQuestion.score_percent)
				: dbEvalQuestion.score_percent,
		section_code: dbEvalQuestion.section_code
	};
}

/**
 * Transform database EvalAnswers to frontend EvalAnswers
 */
export function transformEvalAnswer(dbEvalAnswer: SelectableEvalAnswer): FrontendTypes.EvalAnswers {
	return {
		code: dbEvalAnswer.code,
		question_code: dbEvalAnswer.question_code,
		register_code: dbEvalAnswer.register_code,
		student_answer: dbEvalAnswer.student_answer
	};
}

/**
 * Transform database EvalResults to frontend EvalResults
 */
export function transformEvalResult(dbEvalResult: SelectableEvalResult): FrontendTypes.EvalResults {
	return {
		blank_count: dbEvalResult.blank_count,
		calculated_at: dbEvalResult.calculated_at,
		code: dbEvalResult.code,
		correct_count: dbEvalResult.correct_count,
		eval_code: dbEvalResult.eval_code,
		incorrect_count: dbEvalResult.incorrect_count,
		register_code: dbEvalResult.register_code,
		score:
			typeof dbEvalResult.score === 'string' ? parseFloat(dbEvalResult.score) : dbEvalResult.score,
		section_code: dbEvalResult.section_code
	};
}

/**
 * Transform database Registers to frontend Registers
 */
export function transformRegister(dbRegister: SelectableRegister): FrontendTypes.Registers {
	return {
		code: dbRegister.code,
		created_at: dbRegister.created_at,
		group_name: dbRegister.group_name,
		level_code: dbRegister.level_code,
		roll_code: dbRegister.roll_code,
		student_code: dbRegister.student_code,
		user_code: dbRegister.user_code
	};
}

/**
 * Transform database Permissions to frontend Permissions
 */
export function transformPermission(dbPermission: SelectablePermission): FrontendTypes.Permissions {
	return {
		action: dbPermission.action,
		code: dbPermission.code,
		created_at: dbPermission.created_at,
		entity: dbPermission.entity,
		user_code: dbPermission.user_code
	};
}

// Array transformation helpers
export const transformUsers = (dbUsers: SelectableUser[]): FrontendTypes.Users[] =>
	dbUsers.map(transformUser);

export const transformStudents = (dbStudents: SelectableStudent[]): FrontendTypes.Students[] =>
	dbStudents.map(transformStudent);

export const transformCourses = (dbCourses: SelectableCourse[]): FrontendTypes.Courses[] =>
	dbCourses.map(transformCourse);

export const transformLevels = (dbLevels: SelectableLevel[]): FrontendTypes.Levels[] =>
	dbLevels.map(transformLevel);

export const transformEvals = (dbEvals: SelectableEval[]): FrontendTypes.Evals[] =>
	dbEvals.map(transformEval);

export const transformEvalSections = (
	dbEvalSections: SelectableEvalSection[]
): FrontendTypes.EvalSections[] => dbEvalSections.map(transformEvalSection);

export const transformEvalQuestions = (
	dbEvalQuestions: SelectableEvalQuestion[]
): FrontendTypes.EvalQuestions[] => dbEvalQuestions.map(transformEvalQuestion);

export const transformEvalAnswers = (
	dbEvalAnswers: SelectableEvalAnswer[]
): FrontendTypes.EvalAnswers[] => dbEvalAnswers.map(transformEvalAnswer);

export const transformEvalResults = (
	dbEvalResults: SelectableEvalResult[]
): FrontendTypes.EvalResults[] => dbEvalResults.map(transformEvalResult);

export const transformRegisters = (dbRegisters: SelectableRegister[]): FrontendTypes.Registers[] =>
	dbRegisters.map(transformRegister);

export const transformPermissions = (
	dbPermissions: SelectablePermission[]
): FrontendTypes.Permissions[] => dbPermissions.map(transformPermission);
