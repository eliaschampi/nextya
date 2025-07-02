import { Kysely, sql } from 'kysely';
import { promises as fs } from 'fs';
import path from 'path';

export async function up(db: Kysely<unknown>): Promise<void> {
	// Read and execute the triggers SQL file
	const sqlPath = path.join(process.cwd(), 'src/lib/database/sql/04_triggers.sql');
	const sqlContent = await fs.readFile(sqlPath, 'utf-8');
	
	// Execute the entire content as it contains trigger definitions
	await sql.raw(sqlContent).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Drop all triggers
	await sql`DROP TRIGGER IF EXISTS trigger_users_updated_at ON users`.execute(db);
	await sql`DROP TRIGGER IF EXISTS trigger_users_validate_email ON users`.execute(db);
	await sql`DROP TRIGGER IF EXISTS trigger_students_validate_email ON students`.execute(db);
	await sql`DROP TRIGGER IF EXISTS trigger_eval_questions_update_totals ON eval_questions`.execute(db);
	await sql`DROP TRIGGER IF EXISTS trigger_eval_questions_update_section_totals ON eval_questions`.execute(db);
	await sql`DROP TRIGGER IF EXISTS trigger_eval_answers_validate ON eval_answers`.execute(db);
	await sql`DROP TRIGGER IF EXISTS trigger_eval_answers_recalculate_results ON eval_answers`.execute(db);
	
	// Drop trigger functions
	await sql`DROP FUNCTION IF EXISTS validate_email()`.execute(db);
	await sql`DROP FUNCTION IF EXISTS update_eval_totals()`.execute(db);
	await sql`DROP FUNCTION IF EXISTS update_section_totals()`.execute(db);
	await sql`DROP FUNCTION IF EXISTS validate_answer()`.execute(db);
	await sql`DROP FUNCTION IF EXISTS recalculate_eval_results()`.execute(db);
	await sql`DROP FUNCTION IF EXISTS log_important_changes()`.execute(db);
}
