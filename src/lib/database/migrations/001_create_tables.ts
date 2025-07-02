import { Kysely, sql } from 'kysely';
import { promises as fs } from 'fs';
import path from 'path';

export async function up(db: Kysely<unknown>): Promise<void> {
	// Read and execute the tables SQL file
	const sqlPath = path.join(process.cwd(), 'src/lib/database/sql/01_tables.sql');
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
	// Drop tables in reverse order of dependencies
	await db.schema.dropTable('eval_results').ifExists().execute();
	await db.schema.dropTable('eval_answers').ifExists().execute();
	await db.schema.dropTable('eval_questions').ifExists().execute();
	await db.schema.dropTable('eval_sections').ifExists().execute();
	await db.schema.dropTable('evals').ifExists().execute();
	await db.schema.dropTable('registers').ifExists().execute();
	await db.schema.dropTable('students').ifExists().execute();
	await db.schema.dropTable('courses').ifExists().execute();
	await db.schema.dropTable('levels').ifExists().execute();
	await db.schema.dropTable('permissions').ifExists().execute();
	await db.schema.dropTable('users').ifExists().execute();

	// Drop extensions
	await sql`DROP EXTENSION IF EXISTS "pgcrypto"`.execute(db);
	await sql`DROP EXTENSION IF EXISTS "uuid-ossp"`.execute(db);
}
