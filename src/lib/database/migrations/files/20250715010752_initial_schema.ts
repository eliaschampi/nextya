import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	// Create initial schema from SQL files
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Drop all tables in reverse order
}
