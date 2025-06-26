/**
 * MODERN TYPE TRANSFORMATIONS - Minimal & Efficient
 *
 * ARCHITECTURE PRINCIPLE: Eliminate unnecessary transformations
 * Since we now use Selectable<DB[table]> directly, most transformations are redundant
 * Only keep transformations for special cases (numeric conversions, etc.)
 */

import type { DB } from '$lib/database/types';
import type { Selectable } from 'kysely';

// ============================================================================
// TYPE ALIASES - Direct Kysely types (no transformation needed)
// ============================================================================

// These are now just type aliases - no runtime transformation needed
export type SelectableCourse = Selectable<DB['courses']>;
export type SelectableStudent = Selectable<DB['students']>;
export type SelectableUser = Selectable<DB['users']>;
export type SelectableLevel = Selectable<DB['levels']>;
export type SelectableEval = Selectable<DB['evals']>;
export type SelectableEvalSection = Selectable<DB['eval_sections']>;
export type SelectableEvalQuestion = Selectable<DB['eval_questions']>;
export type SelectableEvalAnswer = Selectable<DB['eval_answers']>;
export type SelectableEvalResult = Selectable<DB['eval_results']>;
export type SelectableRegister = Selectable<DB['registers']>;
export type SelectablePermission = Selectable<DB['permissions']>;

// ============================================================================
// SPECIALIZED TRANSFORMATIONS - Only for special cases
// ============================================================================

/**
 * Transform EvalQuestions - Handle numeric conversion for score_percent
 * This is one of the few cases where transformation is actually needed
 */
export function transformEvalQuestion(dbEvalQuestion: SelectableEvalQuestion): any {
	return {
		...dbEvalQuestion,
		score_percent:
			typeof dbEvalQuestion.score_percent === 'string'
				? parseFloat(dbEvalQuestion.score_percent)
				: dbEvalQuestion.score_percent
	};
}

/**
 * Transform EvalResults - Handle numeric conversion for score
 * This is one of the few cases where transformation is actually needed
 */
export function transformEvalResult(dbEvalResult: SelectableEvalResult): any {
	return {
		...dbEvalResult,
		score:
			typeof dbEvalResult.score === 'string' ? parseFloat(dbEvalResult.score) : dbEvalResult.score
	};
}

// ============================================================================
// ARRAY TRANSFORMATION HELPERS - Minimal & Efficient
// ============================================================================

/**
 * Most transformations are now identity functions since we use Selectable<T> directly
 * Only keep transformations for special cases that need numeric conversion
 */

// Simple identity functions for most types (no transformation needed)
export const transformUsers = (dbUsers: SelectableUser[]): SelectableUser[] => dbUsers;
export const transformStudents = (dbStudents: SelectableStudent[]): SelectableStudent[] =>
	dbStudents;
export const transformCourses = (dbCourses: SelectableCourse[]): SelectableCourse[] => dbCourses;
export const transformLevels = (dbLevels: SelectableLevel[]): SelectableLevel[] => dbLevels;
export const transformEvals = (dbEvals: SelectableEval[]): SelectableEval[] => dbEvals;
export const transformEval = (dbEval: SelectableEval): SelectableEval => dbEval;
export const transformEvalSections = (
	dbEvalSections: SelectableEvalSection[]
): SelectableEvalSection[] => dbEvalSections;
export const transformEvalAnswers = (
	dbEvalAnswers: SelectableEvalAnswer[]
): SelectableEvalAnswer[] => dbEvalAnswers;
export const transformRegisters = (dbRegisters: SelectableRegister[]): SelectableRegister[] =>
	dbRegisters;
export const transformPermissions = (
	dbPermissions: SelectablePermission[]
): SelectablePermission[] => dbPermissions;

// Only these need actual transformation for numeric conversion
export const transformEvalQuestions = (dbEvalQuestions: SelectableEvalQuestion[]): any[] =>
	dbEvalQuestions.map(transformEvalQuestion);

export const transformEvalResults = (dbEvalResults: SelectableEvalResult[]): any[] =>
	dbEvalResults.map(transformEvalResult);
