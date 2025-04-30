import type { Database } from '../../database.types';
export * from './studentResults';

export type Level = Database['public']['Tables']['levels']['Row'];
export type Course = Database['public']['Tables']['courses']['Row'];
export type Student = Database['public']['Tables']['students']['Row'];
export type Permission = Database['public']['Tables']['permissions']['Row'];
export type Eval = Database['public']['Tables']['evals']['Row'];
export type EvalSection = Database['public']['Tables']['eval_sections']['Row'];
export type EvalQuestion = Database['public']['Tables']['eval_questions']['Row'];

export interface SelectForDelete {
	code: string;
	register_code: string;
	name: string;
	mode: 'all' | 'only_register';
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

export type FormSection = {
	course_code: string;
	course_name: string;
	order_in_eval: number;
	question_count: number;
};

export type EvalSectionWithCourse = EvalSection & {
	course_name?: string;
	courses?: { name: string };
};

export type EvalWithSections = Eval & {
	eval_sections: EvalSectionWithCourse[];
	levels?: { name: string };
};

export type ToastType = 'success' | 'danger' | 'warning' | 'info';

export interface ToastState {
	id: number;
	title: string;
	type: ToastType;
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
