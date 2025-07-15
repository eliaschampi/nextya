#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

interface MigrationFile {
	id: string;
	name: string;
	path: string;
	timestamp: number;
}

interface MigrationRecord {
	id: string;
	name: string;
	executed_at: Date;
	batch: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const INIT_DIR = join(PROJECT_ROOT, 'database/init');
const MIGRATIONS_DIR = join(PROJECT_ROOT, 'database/migrations');

const DB_CONFIG = {
	host: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT || '5432'),
	database: process.env.DB_NAME || 'nextya',
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || 'postgres'
};

const log = {
	info: (msg: string) => console.log(`ℹ️  ${msg}`),
	success: (msg: string) => console.log(`✅ ${msg}`),
	error: (msg: string) => console.error(`❌ ${msg}`),
	warning: (msg: string) => console.warn(`⚠️  ${msg}`)
};

class DatabaseManager {
	private pool: Pool;

	constructor() {
		this.pool = new Pool(DB_CONFIG);
	}

	async query(text: string, params?: any[]): Promise<any> {
		const client = await this.pool.connect();
		try {
			return await client.query(text, params);
		} finally {
			client.release();
		}
	}

	async close(): Promise<void> {
		await this.pool.end();
	}

	async checkConnection(): Promise<boolean> {
		try {
			await this.query('SELECT 1');
			return true;
		} catch {
			return false;
		}
	}

	async checkTables(): Promise<boolean> {
		try {
			const result = await this.query(`
				SELECT COUNT(*) as count 
				FROM information_schema.tables 
				WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
			`);
			return parseInt(result.rows[0].count) > 0;
		} catch {
			return false;
		}
	}
}

class MigrationManager {
	private db: DatabaseManager;

	constructor(db: DatabaseManager) {
		this.db = db;
	}

	async ensureMigrationsTable(): Promise<void> {
		await this.db.query(`
			CREATE TABLE IF NOT EXISTS migrations (
				id VARCHAR(255) PRIMARY KEY,
				name VARCHAR(255) NOT NULL,
				executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				batch INTEGER NOT NULL
			)
		`);
	}

	async getExecutedMigrations(): Promise<MigrationRecord[]> {
		await this.ensureMigrationsTable();
		const result = await this.db.query(`
			SELECT id, name, executed_at, batch 
			FROM migrations 
			ORDER BY executed_at ASC
		`);
		return result.rows;
	}

	async getNextBatch(): Promise<number> {
		const result = await this.db.query(`
			SELECT COALESCE(MAX(batch), 0) + 1 as next_batch 
			FROM migrations
		`);
		return result.rows[0].next_batch;
	}

	async recordMigration(migration: MigrationFile, batch: number): Promise<void> {
		await this.db.query(
			`
			INSERT INTO migrations (id, name, batch) 
			VALUES ($1, $2, $3)
		`,
			[migration.id, migration.name, batch]
		);
	}

	async removeMigration(migrationId: string): Promise<void> {
		await this.db.query(`DELETE FROM migrations WHERE id = $1`, [migrationId]);
	}
}

class FileManager {
	static async readSqlFiles(directory: string): Promise<string[]> {
		try {
			const files = await fs.readdir(directory);
			return files.filter((file: string) => file.endsWith('.sql')).sort();
		} catch {
			return [];
		}
	}

	static async readFile(filePath: string): Promise<string> {
		return await fs.readFile(filePath, 'utf-8');
	}

	static async directoryExists(path: string): Promise<boolean> {
		try {
			const stat = await fs.stat(path);
			return stat.isDirectory();
		} catch {
			return false;
		}
	}

	static async ensureDirectory(path: string): Promise<void> {
		try {
			await fs.mkdir(path, { recursive: true });
		} catch {
			// Directory exists
		}
	}

	static async getMigrationFiles(directory: string): Promise<MigrationFile[]> {
		if (!(await this.directoryExists(directory))) return [];

		const files = await this.readSqlFiles(directory);
		return files
			.map((file) => {
				const match = file.match(/^(\d{14})_(.+)\.sql$/);
				if (!match) throw new Error(`Invalid migration file: ${file}`);

				const [, timestamp, name] = match;
				return {
					id: timestamp,
					name: name.replace(/_/g, ' '),
					path: join(directory, file),
					timestamp: parseInt(timestamp)
				};
			})
			.sort((a, b) => a.timestamp - b.timestamp);
	}

	static async createMigrationFile(name: string): Promise<string> {
		await this.ensureDirectory(MIGRATIONS_DIR);

		const timestamp = new Date()
			.toISOString()
			.replace(/[-:T]/g, '')
			.replace(/\.\d{3}Z$/, '');

		const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
		const filepath = join(MIGRATIONS_DIR, filename);

		const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your SQL statements here
`;

		await fs.writeFile(filepath, template);
		return filepath;
	}
}

class DatabaseOperations {
	private db: DatabaseManager;
	private migrations: MigrationManager;

	constructor() {
		this.db = new DatabaseManager();
		this.migrations = new MigrationManager(this.db);
	}

	async initializeDatabase(): Promise<void> {
		log.info('Initializing database from init files...');

		if (!(await FileManager.directoryExists(INIT_DIR))) {
			throw new Error(`Init directory not found: ${INIT_DIR}`);
		}

		const files = await FileManager.readSqlFiles(INIT_DIR);
		if (files.length === 0) throw new Error('No initialization files found');

		log.info(`Found ${files.length} initialization files`);

		for (const file of files) {
			const filePath = join(INIT_DIR, file);
			log.info(`Executing: ${file}`);
			const sql = await FileManager.readFile(filePath);
			await this.db.query(sql);
		}

		log.success('Database initialized successfully');
	}

	async runMigrations(): Promise<void> {
		log.info('Running database migrations...');

		const migrationFiles = await FileManager.getMigrationFiles(MIGRATIONS_DIR);
		const executedMigrations = await this.migrations.getExecutedMigrations();
		const executedIds = new Set(executedMigrations.map((m) => m.id));
		const pendingMigrations = migrationFiles.filter((m) => !executedIds.has(m.id));

		if (pendingMigrations.length === 0) {
			log.info('No pending migrations');
			return;
		}

		log.info(`Found ${pendingMigrations.length} pending migrations`);
		const batch = await this.migrations.getNextBatch();

		for (const migration of pendingMigrations) {
			log.info(`Running migration: ${migration.name}`);
			const sql = await FileManager.readFile(migration.path);
			await this.db.query(sql);
			await this.migrations.recordMigration(migration, batch);
			log.success(`Completed: ${migration.name}`);
		}

		log.success(`All migrations completed (batch ${batch})`);
	}

	async rollbackMigrations(): Promise<void> {
		log.info('Rolling back last migration batch...');

		const executedMigrations = await this.migrations.getExecutedMigrations();
		if (executedMigrations.length === 0) {
			log.info('No migrations to rollback');
			return;
		}

		const lastBatch = Math.max(...executedMigrations.map((m) => m.batch));
		const migrationsToRollback = executedMigrations.filter((m) => m.batch === lastBatch).reverse();

		log.warning(`Rolling back ${migrationsToRollback.length} migrations from batch ${lastBatch}`);

		for (const migration of migrationsToRollback) {
			log.info(`Rolling back: ${migration.name}`);
			await this.migrations.removeMigration(migration.id);
			log.success(`Rolled back: ${migration.name}`);
		}

		log.success(`Rollback completed for batch ${lastBatch}`);
		log.warning('Note: This only removes migration records. Manual cleanup may be required.');
	}

	async showStatus(): Promise<void> {
		log.info('Migration Status');
		console.log('================');

		const executedMigrations = await this.migrations.getExecutedMigrations();
		const migrationFiles = await FileManager.getMigrationFiles(MIGRATIONS_DIR);
		const executedIds = new Set(executedMigrations.map((m) => m.id));

		if (executedMigrations.length === 0) {
			console.log('No migrations executed yet');
		} else {
			console.log('\nExecuted Migrations:');
			executedMigrations.forEach((migration) => {
				console.log(`  ✅ ${migration.id} - ${migration.name} (batch ${migration.batch})`);
			});
		}

		const pendingMigrations = migrationFiles.filter((m) => !executedIds.has(m.id));
		if (pendingMigrations.length > 0) {
			console.log('\nPending Migrations:');
			pendingMigrations.forEach((migration) => {
				console.log(`  ⏳ ${migration.id} - ${migration.name}`);
			});
		}

		console.log(
			`\nTotal: ${executedMigrations.length} executed, ${pendingMigrations.length} pending`
		);
	}

	async checkConnection(): Promise<boolean> {
		return await this.db.checkConnection();
	}

	async checkTables(): Promise<boolean> {
		return await this.db.checkTables();
	}

	async close(): Promise<void> {
		await this.db.close();
	}
}

class CLI {
	private ops: DatabaseOperations;

	constructor() {
		this.ops = new DatabaseOperations();
	}

	async run(args: string[]): Promise<void> {
		const command = args[2] || 'help';

		try {
			switch (command) {
				case 'init':
					await this.handleInit();
					break;
				case 'migrate':
					await this.handleMigrate();
					break;
				case 'rollback':
					await this.handleRollback();
					break;
				case 'status':
					await this.handleStatus();
					break;
				case 'create':
					await this.handleCreate(args.slice(3));
					break;
				case 'check':
					await this.handleCheck();
					break;
				case 'check:tables':
					await this.handleCheckTables();
					break;
				case 'help':
				default:
					this.showHelp();
					break;
			}
		} catch (error) {
			log.error(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
			process.exit(1);
		} finally {
			await this.ops.close();
		}
	}

	private async handleInit(): Promise<void> {
		if (!(await this.ops.checkConnection())) {
			throw new Error('Cannot connect to database');
		}
		await this.ops.initializeDatabase();
	}

	private async handleMigrate(): Promise<void> {
		if (!(await this.ops.checkConnection())) {
			throw new Error('Cannot connect to database');
		}
		await this.ops.runMigrations();
	}

	private async handleRollback(): Promise<void> {
		if (!(await this.ops.checkConnection())) {
			throw new Error('Cannot connect to database');
		}
		await this.ops.rollbackMigrations();
	}

	private async handleStatus(): Promise<void> {
		if (!(await this.ops.checkConnection())) {
			throw new Error('Cannot connect to database');
		}
		await this.ops.showStatus();
	}

	private async handleCreate(args: string[]): Promise<void> {
		if (args.length === 0) {
			throw new Error('Migration name is required');
		}
		const name = args.join(' ');
		const filepath = await FileManager.createMigrationFile(name);
		log.success(`Created migration: ${filepath}`);
	}

	private async handleCheck(): Promise<void> {
		const connected = await this.ops.checkConnection();
		if (connected) {
			log.success('Database connection successful');
		} else {
			log.error('Database connection failed');
			process.exit(1);
		}
	}

	private async handleCheckTables(): Promise<void> {
		if (!(await this.ops.checkConnection())) {
			console.log('false');
			return;
		}
		const hasTables = await this.ops.checkTables();
		console.log(hasTables.toString());
	}

	private showHelp(): void {
		console.log(`
NextYa Database Migration System

Usage: npx tsx database/dev/migrate.ts <command> [options]

Commands:
  init              Initialize database from init files
  migrate           Run pending migrations
  rollback          Rollback last migration batch
  status            Show migration status
  create <name>     Create new migration file
  check             Check database connection
  check:tables      Check if database has tables
  help              Show this help message

Examples:
  npx tsx database/dev/migrate.ts init
  npx tsx database/dev/migrate.ts migrate
  npx tsx database/dev/migrate.ts create "add user preferences"
  npx tsx database/dev/migrate.ts status
  npx tsx database/dev/migrate.ts rollback
`);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const cli = new CLI();
	cli.run(process.argv).catch((error) => {
		log.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	});
}
