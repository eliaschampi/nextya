#!/usr/bin/env tsx

/**
 * NextYa Database Management CLI - Enhanced Version
 * =================================================
 *
 * This enhanced CLI provides comprehensive database management including:
 * - Schema initialization via Docker
 * - Progressive migrations for future changes
 * - Automatic type generation
 * - Database status and health checks
 * - Migration rollback capabilities
 *
 * Architecture:
 * - Initial schema: /docker/init/01-init.sql (Docker initialization)
 * - Future changes: Progressive migrations in /src/lib/database/migrations/files/
 * - Type generation: Automatic after migrations or on-demand
 */

import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { MigrationRunner } from '../src/lib/database/migrations/index.js';
import { createDatabase } from '../src/lib/database/index.js';

const execAsync = promisify(exec);

// Database configuration
const dbConfig = {
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || 'postgres',
	database: process.env.DB_NAME || 'nextya',
	port: parseInt(process.env.DB_PORT || '5432')
};

// Create database instance
const db = createDatabase(dbConfig);
const migrationRunner = new MigrationRunner(db);

async function checkConnection() {
	console.log('🔍 Checking database connection...');
	try {
		await db.selectFrom('users' as any).select('code').limit(1).execute();
		console.log('✅ Database connection successful');
		return true;
	} catch (error) {
		console.error('❌ Database connection failed:', error);
		console.log('💡 Make sure Docker containers are running: docker-compose up -d');
		return false;
	}
}

async function generateTypes() {
	console.log('🔄 Generating TypeScript types from database schema...');

	try {
		const { stdout, stderr } = await execAsync('npm run db:generate');

		if (stderr && !stderr.includes('warning')) {
			console.error('❌ Error generating types:', stderr);
			return false;
		}

		console.log('✅ TypeScript types generated successfully');
		if (stdout) console.log(stdout);
		return true;
	} catch (error) {
		console.error('❌ Failed to generate types:', error);
		return false;
	}
}

async function createMigration(name: string) {
	if (!name) {
		console.error('❌ Migration name is required');
		console.log('Usage: npm run db:create-migration "migration_name"');
		return false;
	}

	const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
	const fileName = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.ts`;
	const filePath = join(process.cwd(), 'src/lib/database/migrations/files', fileName);

	const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

import { Kysely, sql } from 'kysely';

export const name = '${name}';

export async function up(db: Kysely<any>): Promise<void> {
	// Add your schema changes here
	// Example:
	/*
	await db.schema
		.createTable('example_table')
		.addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql\`gen_random_uuid()\`))
		.addColumn('name', 'varchar(255)', (col) => col.notNull())
		.addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql\`CURRENT_TIMESTAMP\`))
		.execute();
	*/
}

export async function down(db: Kysely<any>): Promise<void> {
	// Add rollback logic here (reverse of up function)
	// Example:
	/*
	await db.schema.dropTable('example_table').execute();
	*/
}

export default { name, up, down };
`;

	try {
		await writeFile(filePath, template);
		console.log(`✅ Migration created: ${fileName}`);
		console.log(`📝 Edit the file: ${filePath}`);
		return true;
	} catch (error) {
		console.error('❌ Failed to create migration:', error);
		return false;
	}
}

async function runMigrations() {
	console.log('🔄 Running database migrations...');
	try {
		await migrationRunner.migrate();
		console.log('🔄 Regenerating types after migration...');
		await generateTypes();
		return true;
	} catch (error) {
		console.error('❌ Migration failed:', error);
		return false;
	}
}

async function rollbackMigrations() {
	console.log('🔄 Rolling back last migration batch...');
	try {
		await migrationRunner.rollback();
		console.log('🔄 Regenerating types after rollback...');
		await generateTypes();
		return true;
	} catch (error) {
		console.error('❌ Rollback failed:', error);
		return false;
	}
}

async function migrationStatus() {
	console.log('📊 Checking migration status...');
	try {
		await migrationRunner.status();
		return true;
	} catch (error) {
		console.error('❌ Failed to get migration status:', error);
		return false;
	}
}

async function showStatus() {
	console.log('\n📊 NextYa Database Management System');
	console.log('====================================');
	console.log('🏗️  Initial Schema: /docker/init/01-init.sql (Docker auto-init)');
	console.log('🔄 Future Changes: Progressive migrations');
	console.log('📝 TypeScript Types: src/lib/database/types.ts');
	console.log('📁 Migrations: src/lib/database/migrations/files/');
	console.log('\n💡 Common Commands:');
	console.log('   npm run db:migrate        - Run pending migrations');
	console.log('   npm run db:rollback       - Rollback last migration batch');
	console.log('   npm run db:status         - Show migration status');
	console.log('   npm run db:generate       - Generate TypeScript types');
	console.log('   npm run db:create "name"  - Create new migration');
	console.log('   npm run db:reset          - Reset database (Docker)');
}

// Parse command line arguments
const command = process.argv[2];
const migrationName = process.argv[3];

async function main() {
	switch (command) {
		case 'migrate':
		case 'up':
			if (await checkConnection()) {
				await runMigrations();
			}
			break;
		case 'rollback':
		case 'down':
			if (await checkConnection()) {
				await rollbackMigrations();
			}
			break;
		case 'status':
		case 'info':
			if (await checkConnection()) {
				await migrationStatus();
			} else {
				await showStatus();
			}
			break;
		case 'generate':
		case 'types':
			if (await checkConnection()) {
				await generateTypes();
			}
			break;
		case 'create':
		case 'new':
			await createMigration(migrationName);
			break;
		case 'check':
			await checkConnection();
			break;
		default:
			console.log('NextYa Database Management CLI - Enhanced');
			console.log('========================================');
			console.log('Usage: tsx scripts/migrate.ts [command] [options]');
			console.log('');
			console.log('Commands:');
			console.log('  migrate, up              Run pending migrations');
			console.log('  rollback, down           Rollback last migration batch');
			console.log('  status, info             Show migration status');
			console.log('  generate, types          Generate TypeScript types');
			console.log('  create "name"            Create new migration file');
			console.log('  check                    Check database connection');
			console.log('');
			console.log('Examples:');
			console.log('  tsx scripts/migrate.ts migrate');
			console.log('  tsx scripts/migrate.ts create "add user preferences"');
			console.log('  tsx scripts/migrate.ts rollback');
			console.log('');
			console.log('Architecture:');
			console.log('  • Initial schema: Docker initialization (/docker/init/01-init.sql)');
			console.log('  • Future changes: Progressive migrations with rollback support');
			console.log('  • Type safety: Automatic TypeScript type generation');
			break;
	}

	// Clean up database connection
	try {
		await db.destroy();
	} catch (error) {
		// Ignore cleanup errors
	}
}

main().catch(console.error);
