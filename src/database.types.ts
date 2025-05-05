export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	graphql_public: {
		Tables: {
			[_ in never]: never;
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			graphql: {
				Args: {
					operationName?: string;
					query?: string;
					variables?: Json;
					extensions?: Json;
				};
				Returns: Json;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
	public: {
		Tables: {
			courses: {
				Row: {
					code: string;
					created_at: string | null;
					name: string;
					order: number;
					user_code: string;
				};
				Insert: {
					code?: string;
					created_at?: string | null;
					name: string;
					order?: number;
					user_code: string;
				};
				Update: {
					code?: string;
					created_at?: string | null;
					name?: string;
					order?: number;
					user_code?: string;
				};
				Relationships: [];
			};
			eval_answers: {
				Row: {
					code: string;
					question_code: string;
					register_code: string;
					student_answer: string | null;
				};
				Insert: {
					code?: string;
					question_code: string;
					register_code: string;
					student_answer?: string | null;
				};
				Update: {
					code?: string;
					question_code?: string;
					register_code?: string;
					student_answer?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_eval_answers_question';
						columns: ['question_code'];
						isOneToOne: false;
						referencedRelation: 'eval_questions';
						referencedColumns: ['code'];
					},
					{
						foreignKeyName: 'fk_eval_answers_register';
						columns: ['register_code'];
						isOneToOne: false;
						referencedRelation: 'registers';
						referencedColumns: ['code'];
					},
					{
						foreignKeyName: 'fk_eval_answers_register';
						columns: ['register_code'];
						isOneToOne: false;
						referencedRelation: 'student_registers';
						referencedColumns: ['register_code'];
					}
				];
			};
			eval_questions: {
				Row: {
					code: string;
					correct_key: string;
					eval_code: string;
					omitable: boolean | null;
					order_in_eval: number;
					score_percent: number;
					section_code: string;
				};
				Insert: {
					code?: string;
					correct_key: string;
					eval_code: string;
					omitable?: boolean | null;
					order_in_eval: number;
					score_percent?: number;
					section_code: string;
				};
				Update: {
					code?: string;
					correct_key?: string;
					eval_code?: string;
					omitable?: boolean | null;
					order_in_eval?: number;
					score_percent?: number;
					section_code?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_eval_questions_eval';
						columns: ['eval_code'];
						isOneToOne: false;
						referencedRelation: 'evals';
						referencedColumns: ['code'];
					},
					{
						foreignKeyName: 'fk_eval_questions_section';
						columns: ['section_code'];
						isOneToOne: false;
						referencedRelation: 'eval_sections';
						referencedColumns: ['code'];
					}
				];
			};
			eval_results: {
				Row: {
					blank_count: number;
					calculated_at: string | null;
					code: string;
					correct_count: number;
					eval_code: string;
					incorrect_count: number;
					register_code: string;
					score: number;
					section_code: string | null;
				};
				Insert: {
					blank_count?: number;
					calculated_at?: string | null;
					code?: string;
					correct_count?: number;
					eval_code: string;
					incorrect_count?: number;
					register_code: string;
					score?: number;
					section_code?: string | null;
				};
				Update: {
					blank_count?: number;
					calculated_at?: string | null;
					code?: string;
					correct_count?: number;
					eval_code?: string;
					incorrect_count?: number;
					register_code?: string;
					score?: number;
					section_code?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_eval_results_eval';
						columns: ['eval_code'];
						isOneToOne: false;
						referencedRelation: 'evals';
						referencedColumns: ['code'];
					},
					{
						foreignKeyName: 'fk_eval_results_register';
						columns: ['register_code'];
						isOneToOne: false;
						referencedRelation: 'registers';
						referencedColumns: ['code'];
					},
					{
						foreignKeyName: 'fk_eval_results_register';
						columns: ['register_code'];
						isOneToOne: false;
						referencedRelation: 'student_registers';
						referencedColumns: ['register_code'];
					},
					{
						foreignKeyName: 'fk_eval_results_section';
						columns: ['section_code'];
						isOneToOne: false;
						referencedRelation: 'eval_sections';
						referencedColumns: ['code'];
					}
				];
			};
			eval_sections: {
				Row: {
					code: string;
					course_code: string;
					eval_code: string;
					order_in_eval: number;
					question_count: number;
				};
				Insert: {
					code?: string;
					course_code: string;
					eval_code: string;
					order_in_eval: number;
					question_count: number;
				};
				Update: {
					code?: string;
					course_code?: string;
					eval_code?: string;
					order_in_eval?: number;
					question_count?: number;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_eval_sections_course';
						columns: ['course_code'];
						isOneToOne: false;
						referencedRelation: 'courses';
						referencedColumns: ['code'];
					},
					{
						foreignKeyName: 'fk_eval_sections_eval';
						columns: ['eval_code'];
						isOneToOne: false;
						referencedRelation: 'evals';
						referencedColumns: ['code'];
					}
				];
			};
			evals: {
				Row: {
					code: string;
					created_at: string | null;
					eval_date: string;
					group_name: string;
					level_code: string;
					name: string;
					updated_at: string | null;
					user_code: string;
				};
				Insert: {
					code?: string;
					created_at?: string | null;
					eval_date: string;
					group_name: string;
					level_code: string;
					name: string;
					updated_at?: string | null;
					user_code: string;
				};
				Update: {
					code?: string;
					created_at?: string | null;
					eval_date?: string;
					group_name?: string;
					level_code?: string;
					name?: string;
					updated_at?: string | null;
					user_code?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_evals_level';
						columns: ['level_code'];
						isOneToOne: false;
						referencedRelation: 'levels';
						referencedColumns: ['code'];
					}
				];
			};
			levels: {
				Row: {
					abr: string;
					code: string;
					created_at: string | null;
					name: string;
					users: string[];
				};
				Insert: {
					abr: string;
					code?: string;
					created_at?: string | null;
					name: string;
					users: string[];
				};
				Update: {
					abr?: string;
					code?: string;
					created_at?: string | null;
					name?: string;
					users?: string[];
				};
				Relationships: [];
			};
			permissions: {
				Row: {
					code: string;
					entity: Database['public']['Enums']['entity_enum'];
					user_action: string;
					user_code: string;
				};
				Insert: {
					code?: string;
					entity: Database['public']['Enums']['entity_enum'];
					user_action: string;
					user_code: string;
				};
				Update: {
					code?: string;
					entity?: Database['public']['Enums']['entity_enum'];
					user_action?: string;
					user_code?: string;
				};
				Relationships: [];
			};
			registers: {
				Row: {
					code: string;
					created_at: string | null;
					group_name: string;
					level_code: string;
					roll_code: string;
					student_code: string;
					user_code: string;
				};
				Insert: {
					code?: string;
					created_at?: string | null;
					group_name: string;
					level_code: string;
					roll_code: string;
					student_code: string;
					user_code: string;
				};
				Update: {
					code?: string;
					created_at?: string | null;
					group_name?: string;
					level_code?: string;
					roll_code?: string;
					student_code?: string;
					user_code?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_registers_level';
						columns: ['level_code'];
						isOneToOne: false;
						referencedRelation: 'levels';
						referencedColumns: ['code'];
					},
					{
						foreignKeyName: 'fk_registers_student';
						columns: ['student_code'];
						isOneToOne: false;
						referencedRelation: 'student_registers';
						referencedColumns: ['student_code'];
					},
					{
						foreignKeyName: 'fk_registers_student';
						columns: ['student_code'];
						isOneToOne: false;
						referencedRelation: 'students';
						referencedColumns: ['code'];
					}
				];
			};
			students: {
				Row: {
					code: string;
					created_at: string | null;
					email: string | null;
					last_name: string;
					name: string;
					phone: string | null;
					updated_at: string | null;
					user_code: string;
				};
				Insert: {
					code?: string;
					created_at?: string | null;
					email?: string | null;
					last_name: string;
					name: string;
					phone?: string | null;
					updated_at?: string | null;
					user_code: string;
				};
				Update: {
					code?: string;
					created_at?: string | null;
					email?: string | null;
					last_name?: string;
					name?: string;
					phone?: string | null;
					updated_at?: string | null;
					user_code?: string;
				};
				Relationships: [];
			};
		};
		Views: {
			student_register_results: {
				Row: {
					blank_count: number | null;
					calculated_at: string | null;
					correct_count: number | null;
					eval_code: string | null;
					eval_date: string | null;
					eval_name: string | null;
					incorrect_count: number | null;
					level_code: string | null;
					level_name: string | null;
					register_code: string | null;
					register_group_name: string | null;
					result_code: string | null;
					roll_code: string | null;
					score: number | null;
					student_code: string | null;
					student_last_name: string | null;
					student_name: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_eval_results_eval';
						columns: ['eval_code'];
						isOneToOne: false;
						referencedRelation: 'evals';
						referencedColumns: ['code'];
					},
					{
						foreignKeyName: 'fk_eval_results_register';
						columns: ['register_code'];
						isOneToOne: false;
						referencedRelation: 'registers';
						referencedColumns: ['code'];
					},
					{
						foreignKeyName: 'fk_eval_results_register';
						columns: ['register_code'];
						isOneToOne: false;
						referencedRelation: 'student_registers';
						referencedColumns: ['register_code'];
					},
					{
						foreignKeyName: 'fk_registers_level';
						columns: ['level_code'];
						isOneToOne: false;
						referencedRelation: 'levels';
						referencedColumns: ['code'];
					},
					{
						foreignKeyName: 'fk_registers_student';
						columns: ['student_code'];
						isOneToOne: false;
						referencedRelation: 'student_registers';
						referencedColumns: ['student_code'];
					},
					{
						foreignKeyName: 'fk_registers_student';
						columns: ['student_code'];
						isOneToOne: false;
						referencedRelation: 'students';
						referencedColumns: ['code'];
					}
				];
			};
			student_registers: {
				Row: {
					created_at: string | null;
					email: string | null;
					group_name: string | null;
					last_name: string | null;
					level: string | null;
					level_code: string | null;
					name: string | null;
					phone: string | null;
					register_code: string | null;
					roll_code: string | null;
					student_code: string | null;
				};
				Relationships: [
					{
						foreignKeyName: 'fk_registers_level';
						columns: ['level_code'];
						isOneToOne: false;
						referencedRelation: 'levels';
						referencedColumns: ['code'];
					}
				];
			};
		};
		Functions: {
			get_level_course_scores: {
				Args: { p_level_code: string };
				Returns: {
					course_code: string;
					course_name: string;
					course_abr: string;
					average_score: number;
				}[];
			};
			get_register_eval_results: {
				Args: { p_eval_code: string };
				Returns: {
					result_code: string;
					register_code: string;
					eval_code: string;
					section_code: string;
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
				}[];
			};
			get_student_eval_report: {
				Args: { p_student_code: string };
				Returns: {
					eval_name: string;
					eval_code: string;
					eval_date: string;
					general_score: number;
					register_code: string;
					result_code: string;
					course_scores: Json;
				}[];
			};
			has_permission: {
				Args: { entity_name: string; permission: string };
				Returns: boolean;
			};
			import_student_register: {
				Args: {
					p_name: string;
					p_last_name: string;
					p_phone: string;
					p_email: string;
					p_level_code: string;
					p_group_name: string;
					p_roll_code: string;
					p_user_code: string;
				};
				Returns: undefined;
			};
			upsert_eval_results: {
				Args: {
					p_eval_code: string;
					p_register_code: string;
					p_answers: Json;
					p_general_result: Json;
					p_section_results: Json;
				};
				Returns: undefined;
			};
		};
		Enums: {
			entity_enum:
				| 'users'
				| 'levels'
				| 'courses'
				| 'students'
				| 'registers'
				| 'evals'
				| 'eval_sections'
				| 'eval_questions'
				| 'eval_answers'
				| 'eval_results';
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
				Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
		: never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
			Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
		? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema['Tables']
		| { schema: keyof Database },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
		: never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
		? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof Database },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
		: never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
	? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
		? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema['CompositeTypes']
		| { schema: keyof Database },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof Database;
	}
		? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
		: never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
	? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
		? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	graphql_public: {
		Enums: {}
	},
	public: {
		Enums: {
			entity_enum: [
				'users',
				'levels',
				'courses',
				'students',
				'registers',
				'evals',
				'eval_sections',
				'eval_questions',
				'eval_answers',
				'eval_results'
			]
		}
	}
} as const;
