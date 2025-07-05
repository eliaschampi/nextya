/**
 * Core domain types for NextYa application
 * Clean, modern architecture using Kysely types directly
 *
 * ARCHITECTURE PRINCIPLE: Use Kysely-generated types as single source of truth
 * This eliminates redundancy and ensures type consistency
 */

import type { Selectable, Insertable, Updateable } from 'kysely';
import type { DB } from '$lib/database/types';
import type { ApiOmrErrorData, ApiOmrSuccessData } from './api';

// ============================================================================
// PRIMARY TYPES - Direct from Kysely (Single Source of Truth)
// ============================================================================

// Clean frontend types using Kysely's Selectable utility
// This automatically handles ColumnType unwrapping and provides clean types
export type Users = Selectable<DB['users']>;
export type Students = Selectable<DB['students']>;
export type Courses = Selectable<DB['courses']>;
export type Levels = Selectable<DB['levels']>;
export type Evals = Selectable<DB['evals']>;
export type EvalSections = Selectable<DB['eval_sections']>;
export type EvalQuestions = Selectable<DB['eval_questions']>;
export type EvalAnswers = Selectable<DB['eval_answers']>;
export type EvalResults = Selectable<DB['eval_results']>;
export type Registers = Selectable<DB['registers']>;
export type Permissions = Selectable<DB['permissions']>;

// Insertable types for creating new records
export type NewUsers = Insertable<DB['users']>;
export type NewStudents = Insertable<DB['students']>;
export type NewCourses = Insertable<DB['courses']>;
export type NewLevels = Insertable<DB['levels']>;
export type NewEvals = Insertable<DB['evals']>;
export type NewEvalSections = Insertable<DB['eval_sections']>;
export type NewEvalQuestions = Insertable<DB['eval_questions']>;
export type NewEvalAnswers = Insertable<DB['eval_answers']>;
export type NewEvalResults = Insertable<DB['eval_results']>;
export type NewRegisters = Insertable<DB['registers']>;
export type NewPermissions = Insertable<DB['permissions']>;

// Updateable types for updating existing records
export type UpdateUsers = Updateable<DB['users']>;
export type UpdateStudents = Updateable<DB['students']>;
export type UpdateCourses = Updateable<DB['courses']>;
export type UpdateLevels = Updateable<DB['levels']>;
export type UpdateEvals = Updateable<DB['evals']>;
export type UpdateEvalSections = Updateable<DB['eval_sections']>;
export type UpdateEvalQuestions = Updateable<DB['eval_questions']>;
export type UpdateEvalAnswers = Updateable<DB['eval_answers']>;
export type UpdateEvalResults = Updateable<DB['eval_results']>;
export type UpdateRegisters = Updateable<DB['registers']>;
export type UpdatePermissions = Updateable<DB['permissions']>;

// Re-export database types for internal use
export type { DB } from '$lib/database/types';

// ============================================================================
// BUSINESS DOMAIN TYPES - Application-specific extensions
// ============================================================================

// ============================================================================
// VALUE OBJECTS & ENUMS - Domain-specific types
// ============================================================================

export type EntityType =
	| 'levels'
	| 'courses'
	| 'students'
	| 'registers'
	| 'evals'
	| 'eval_sections'
	| 'eval_questions'
	| 'eval_answers'
	| 'eval_results';

export type AnswerValue = 'A' | 'B' | 'C' | 'D' | 'E' | null | 'error_multiple';
export type ToastType = 'success' | 'danger' | 'warning' | 'info';
export type FileStatus = 'pending' | 'processing' | 'success' | 'error';

// ============================================================================
// COMPOSITE TYPES - Business operations with joins
// ============================================================================

export interface EvalSectionWithCourse extends EvalSections {
	course_name?: string;
	courses?: { name: string };
}

export interface EvalWithSections extends Evals {
	eval_sections: EvalSectionWithCourse[];
	levels?: { name: string };
}

export interface RegisterStudent {
	student_code: string;
	register_code: string;
	name: string;
	last_name: string;
	level_code: string;
	email: string;
	phone: string | null;
	roll_code: string;
	group_name: string;
	level: string;
	created_at: string;
}

export interface SimpleUser {
	code: string;
	name: string;
	last_name: string;
}

export interface ResultItem {
	result_code: string;
	register_code: string;
	eval_code: string;
	section_code: string | null;
	correct_count: number;
	incorrect_count: number;
	blank_count: number;
	score: number;
	calculated_at: string;
	student_code: string;
	roll_code: string;
	group_name: string;
	level_code: string;
	name: string;
	last_name: string;
	level_name: string;
}

export interface SelectForDelete {
	code: string;
	register_code: string;
	name: string;
	mode: 'all' | 'only_register';
}

export interface FormSection {
	course_code: string;
	course_name: string;
	order_in_eval: number;
	question_count: number;
}

export interface FileEntry {
	file: File;
	id: string; // Identificador único para la clave
	status: FileStatus;
	result: ApiOmrSuccessData | null;
	error: ApiOmrErrorData | null;
	saved: boolean;
	formatValid: boolean; // Indica si la imagen tiene proporción A5
	formatName: string; // Nombre del formato detectado (A5 Vertical, A5 Horizontal, etc.)
}

export interface ToastState {
	id: number;
	title: string;
	type: ToastType;
}
