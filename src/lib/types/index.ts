import type { Database } from 'lucide-svelte';

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

export type EvalWithSections = Eval & {
	eval_sections: (EvalSection & { course_name: string })[];
	levels?: { name: string };
};

export type ToastType = 'success' | 'danger' | 'warning';

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
