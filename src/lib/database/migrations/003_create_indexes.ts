import { Kysely, sql } from 'kysely';
import { promises as fs } from 'fs';
import path from 'path';

export async function up(db: Kysely<unknown>): Promise<void> {
	// Read and execute the indexes SQL file
	const sqlPath = path.join(process.cwd(), 'src/lib/database/sql/03_indexes.sql');
	const sqlContent = await fs.readFile(sqlPath, 'utf-8');

	// Split by semicolon and execute each statement
	const statements = sqlContent
		.split(';')
		.map((stmt) => stmt.trim())
		.filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));

	for (const statement of statements) {
		if (statement.trim()) {
			await sql.raw(statement).execute(db);
		}
	}
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Drop all custom indexes (keep primary key and foreign key indexes)
	const indexesToDrop = [
		'idx_users_email',
		'idx_registers_unique',
		'idx_permissions_user_code',
		'idx_permissions_granted_by',
		'idx_levels_user_code',
		'idx_courses_user_code',
		'idx_students_user_code',
		'idx_registers_student_code',
		'idx_registers_level_code',
		'idx_registers_user_code',
		'idx_evals_level_code',
		'idx_evals_user_code',
		'idx_eval_sections_eval_code',
		'idx_eval_sections_course_code',
		'idx_eval_questions_eval_code',
		'idx_eval_questions_section_code',
		'idx_eval_answers_question_code',
		'idx_eval_answers_register_code',
		'idx_eval_results_eval_code',
		'idx_eval_results_register_code',
		'idx_eval_results_section_code',
		'idx_users_email_lower',
		'idx_students_name',
		'idx_students_last_name',
		'idx_students_email',
		'idx_students_full_name',
		'idx_evals_eval_date',
		'idx_evals_date_level',
		'idx_eval_questions_order',
		'idx_eval_questions_section_order',
		'idx_eval_results_score',
		'idx_eval_results_eval_score',
		'idx_eval_results_general',
		'idx_eval_results_sections',
		'idx_student_eval_history',
		'idx_course_performance',
		'idx_question_analysis',
		'idx_permissions_lookup',
		'idx_users_active',
		'idx_users_super_admin',
		'idx_evals_recent',
		'idx_eval_answers_correct',
		'idx_levels_order',
		'idx_courses_order',
		'idx_users_created_at',
		'idx_students_created_at',
		'idx_evals_created_at',
		'idx_eval_results_created_at'
	];

	for (const indexName of indexesToDrop) {
		await sql.raw(`DROP INDEX IF EXISTS ${indexName}`).execute(db);
	}
}
