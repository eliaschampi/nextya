/**
 * Core domain types for NextYa application
 * These types represent the core business entities and should be stable
 *
 * Note: Database types are defined in src/lib/database/types.ts
 * This file contains business logic types and re-exports database types for convenience
 */

// Import and re-export database types for convenience
import type {
	Users,
	Students,
	Courses,
	Levels,
	Evals,
	EvalSections,
	EvalQuestions,
	EvalAnswers,
	EvalResults,
	Registers,
	Permissions,
	DB
} from '$lib/database/types';
import type { ApiOmrErrorData, ApiOmrSuccessData } from './api';

export type {
	Users,
	Students,
	Courses,
	Levels,
	Evals,
	EvalSections,
	EvalQuestions,
	EvalAnswers,
	EvalResults,
	Registers,
	Permissions,
	DB
};

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
