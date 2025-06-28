/**
 * Types for the student results page
 */

/**
 * Represents a student register with level information
 */
export interface StudentRegister {
	code: string;
	level_code: string;
	group_name: string;
	roll_code: string;
	levels: {
		name: string;
	};
}

/**
 * Represents a student evaluation result
 */
export interface StudentResult {
	// Primary identifiers
	result_code: string;
	register_code: string;
	eval_code: string;

	// Evaluation information
	eval_name: string;
	eval_date: string;

	// Student registration information
	roll_code: string;

	// Score information
	correct_count: number;
	incorrect_count: number;
	blank_count: number;
	score: number;

	// Additional fields that might be present in the database
	calculated_at?: string | null;

	// Student information
	student_code?: string | null;
	student_name?: string | null;
	student_last_name?: string | null;

	// Level and group information
	level_code?: string | null;
	level_name?: string | null;
	group_name?: string | null;

	// Section information
	section_code?: string | null;
}

/**
 * Represents a student answer to a question
 * This is a more detailed version of StudentAnswer from api.ts
 */
export interface StudentQuestionAnswer {
	// Required fields
	question_code: string;
	is_correct: boolean;

	// Answer can be null for blank answers
	answer: string | null;
	student_answer: string | null; // Ensure consistency with StudentAnswer

	// Section information
	section_code: string | null;
	section_name?: string | null;

	// Question metadata
	order_in_eval: number; // Make required for consistency
	correct_key: string; // Make required for consistency
	score_percent?: number;

	// Answer status flags
	is_blank: boolean; // Make required for consistency
	is_multiple: boolean; // Make required for consistency
}

/**
 * Represents a section score in an evaluation
 */
export interface SectionScore {
	section_code: string;
	section_name: string;
	correct_count: number;
	incorrect_count: number;
	blank_count: number;
	total_questions: number;
	score: number;
}

/**
 * Represents a general score in an evaluation
 */
export interface GeneralScore {
	correct_count: number;
	incorrect_count: number;
	blank_count: number;
	total_questions: number;
	score: number;
}

/**
 * Represents the detailed result of an evaluation
 */
export interface EvaluationResult {
	code: string;
	student: {
		code: string;
		name: string;
		last_name: string;
	};
	register: {
		code: string;
		roll_code: string;
		group_name: string;
		level_code: string;
	};
	eval: {
		code: string;
		name: string;
		date: string;
		level_name: string;
	};
	scores: {
		general: GeneralScore;
		by_section: Record<string, SectionScore>;
	};
	answers: StudentQuestionAnswer[];
}

/**
 * Response from the student results API
 */
export interface StudentResultsResponse {
	student: {
		code: string;
		name: string;
		last_name: string;
	};
	registers: StudentRegister[];
	results: StudentResult[];
}

/**
 * Sort order for results
 */
export type SortOrder = 'asc' | 'desc';
