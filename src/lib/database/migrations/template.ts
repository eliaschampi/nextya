/**
 * Migration Template
 * ==================
 * 
 * Copy this template to create new migrations.
 * Name your migration file with timestamp: YYYYMMDDHHMMSS_description.ts
 * 
 * Example: 20250108120000_add_user_preferences.ts
 */

import { Kysely, sql } from 'kysely';

export const name = 'Add user preferences table'; // Human-readable name

export async function up(db: Kysely<any>): Promise<void> {
	// Add your schema changes here
	// Example:
	/*
	await db.schema
		.createTable('user_preferences')
		.addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
		.addColumn('user_code', 'uuid', (col) => col.notNull().references('users.code').onDelete('cascade'))
		.addColumn('theme', 'varchar(20)', (col) => col.notNull().defaultTo('light'))
		.addColumn('language', 'varchar(10)', (col) => col.notNull().defaultTo('en'))
		.addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute();

	// Add indexes
	await db.schema
		.createIndex('user_preferences_user_code_idx')
		.on('user_preferences')
		.column('user_code')
		.execute();

	// Add constraints
	await db.schema
		.alterTable('user_preferences')
		.addCheckConstraint('user_preferences_theme_check', sql`theme IN ('light', 'dark')`)
		.execute();
	*/
}

export async function down(db: Kysely<any>): Promise<void> {
	// Add rollback logic here (reverse of up function)
	// Example:
	/*
	await db.schema.dropTable('user_preferences').execute();
	*/
}

// Export as default for dynamic imports
export default { name, up, down };
