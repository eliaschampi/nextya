/**
 * Core domain types for NextYa application
 * These types represent the core business entities and should be stable
 *
 * Note: Database types are defined in src/lib/database/types.ts
 * This file contains clean frontend types without Kysely ColumnType wrappers
 */

import type { ApiOmrErrorData, ApiOmrSuccessData } from './api';

// Clean frontend types - these are the types used throughout the application
// They mirror the database structure but without Kysely's ColumnType wrappers

export interface Users {
	code: string;
	created_at: Date;
	email: string;
	is_email_verified: boolean;
	is_super_admin: boolean;
	last_login: Date | null;
	last_name: string | null;
	name: string | null;
	password_hash: string;
	photo_url: string | null;
	updated_at: Date;
}

export interface Students {
	code: string;
	created_at: Date | null;
	email: string;
	last_name: string;
	name: string;
	phone: string | null;
	updated_at: Date | null;
	user_code: string;
}

export interface Courses {
	abr: string;
	code: string;
	created_at: Date | null;
	name: string;
	order: number;
	user_code: string;
}

export interface Levels {
	abr: string;
	code: string;
	created_at: Date | null;
	name: string;
	users: string[];
}

export interface Evals {
	code: string;
	created_at: Date | null;
	eval_date: Date;
	group_name: string;
	level_code: string;
	name: string;
	updated_at: Date | null;
	user_code: string;
}

export interface EvalSections {
	code: string;
	course_code: string;
	eval_code: string;
	order_in_eval: number;
	question_count: number;
}

export interface EvalQuestions {
	code: string;
	correct_key: string;
	eval_code: string;
	omitable: boolean | null;
	order_in_eval: number;
	score_percent: number;
	section_code: string;
}

export interface EvalAnswers {
	code: string;
	question_code: string;
	register_code: string;
	student_answer: string | null;
}

export interface EvalResults {
	blank_count: number;
	calculated_at: Date | null;
	code: string;
	correct_count: number;
	eval_code: string;
	incorrect_count: number;
	register_code: string;
	score: number;
	section_code: string | null;
}

export interface Registers {
	code: string;
	created_at: Date | null;
	group_name: string;
	level_code: string;
	roll_code: string;
	student_code: string;
	user_code: string;
}

export interface Permissions {
	action: string;
	code: string;
	created_at: Date;
	entity: string;
	user_code: string;
}

// Re-export database types for internal use
export type { DB } from '$lib/database/types';

// Frontend User type for the users page (different from session User)
export interface User {
	id: string;
	email: string;
	name: string | null;
	last_name: string | null;
	photo_url: string | null;
	email_confirmed_at: boolean;
	created_at: Date;
	last_sign_in_at: Date | null;
	user_metadata: {
		name: string | null;
		last_name: string | null;
		photo_url: string | null;
	};
}

// Common value objects
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

// Composite types for business operations
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
	id: string;
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
