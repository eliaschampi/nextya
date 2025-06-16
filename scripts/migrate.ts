#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import path from 'path';
import { Kysely, Migrator, PostgresDialect, FileMigrationProvider } from 'kysely';
import { Pool } from 'pg';

// Database connection
const pool = new Pool({
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || 'postgres',
	database: process.env.DB_NAME || 'nextya',
	port: parseInt(process.env.DB_PORT || '5432')
});

const db = new Kysely<any>({
	dialect: new PostgresDialect({ pool })
});

async function migrateToLatest() {
	const migrator = new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: path.join(process.cwd(), 'src/lib/database/migrations')
		})
	});

	const { error, results } = await migrator.migrateToLatest();

	results?.forEach((it) => {
		if (it.status === 'Success') {
			console.log(`✅ Migration "${it.migrationName}" was executed successfully`);
		} else if (it.status === 'Error') {
			console.error(`❌ Failed to execute migration "${it.migrationName}"`);
		}
	});

	if (error) {
		console.error('❌ Failed to migrate');
		console.error(error);
		process.exit(1);
	}

	console.log('🎉 All migrations completed successfully!');
	await pool.end();
}

async function migrateDown() {
	const migrator = new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: path.join(process.cwd(), 'src/lib/database/migrations')
		})
	});

	const { error, results } = await migrator.migrateDown();

	results?.forEach((it) => {
		if (it.status === 'Success') {
			console.log(`✅ Migration "${it.migrationName}" was rolled back successfully`);
		} else if (it.status === 'Error') {
			console.error(`❌ Failed to rollback migration "${it.migrationName}"`);
		}
	});

	if (error) {
		console.error('❌ Failed to rollback migration');
		console.error(error);
		process.exit(1);
	}

	console.log('🎉 Migration rolled back successfully!');
	await pool.end();
}

// Parse command line arguments
const command = process.argv[2];

switch (command) {
	case 'up':
	case 'latest':
		migrateToLatest();
		break;
	case 'down':
		migrateDown();
		break;
	default:
		console.log('Usage: npm run migrate [up|down]');
		console.log('  up/latest: Run all pending migrations');
		console.log('  down: Rollback the last migration');
		process.exit(1);
}
