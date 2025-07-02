import { Kysely, sql } from 'kysely';
import { promises as fs } from 'fs';
import path from 'path';

export async function up(db: Kysely<unknown>): Promise<void> {
	// Read and execute the views SQL file
	const sqlPath = path.join(process.cwd(), 'src/lib/database/sql/05_views.sql');
	const sqlContent = await fs.readFile(sqlPath, 'utf-8');
	
	// Execute the entire content as it contains view definitions
	await sql.raw(sqlContent).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Drop all views
	await sql`DROP VIEW IF EXISTS v_students_complete`.execute(db);
	await sql`DROP VIEW IF EXISTS v_user_permissions`.execute(db);
	await sql`DROP VIEW IF EXISTS v_evaluations_complete`.execute(db);
	await sql`DROP VIEW IF EXISTS v_eval_sections_complete`.execute(db);
	await sql`DROP VIEW IF EXISTS v_student_registrations`.execute(db);
	await sql`DROP VIEW IF EXISTS v_student_results_summary`.execute(db);
	await sql`DROP VIEW IF EXISTS v_question_difficulty`.execute(db);
	await sql`DROP VIEW IF EXISTS v_course_performance`.execute(db);
	await sql`DROP VIEW IF EXISTS v_recent_evaluations`.execute(db);
	await sql`DROP VIEW IF EXISTS v_teacher_statistics`.execute(db);
}
