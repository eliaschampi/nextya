import { Kysely, sql } from 'kysely';
import { promises as fs } from 'fs';
import path from 'path';

export async function up(db: Kysely<unknown>): Promise<void> {
	// Read and execute the functions SQL file
	const sqlPath = path.join(process.cwd(), 'src/lib/database/sql/02_functions.sql');
	const sqlContent = await fs.readFile(sqlPath, 'utf-8');

	// Execute the entire content as it contains function definitions
	await sql.raw(sqlContent).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Drop all functions
	await sql`DROP FUNCTION IF EXISTS update_updated_at()`.execute(db);
	await sql`DROP FUNCTION IF EXISTS get_student_score_evolution(TEXT)`.execute(db);
	await sql`DROP FUNCTION IF EXISTS get_student_course_performance(TEXT)`.execute(db);
	await sql`DROP FUNCTION IF EXISTS get_eval_dashboard_data(TEXT)`.execute(db);
	await sql`DROP FUNCTION IF EXISTS get_student_eval_report(TEXT)`.execute(db);
}
