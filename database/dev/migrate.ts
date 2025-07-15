import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { Kysely, PostgresDialect, Migrator, FileMigrationProvider, sql } from 'kysely';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Database configuration
const dbConfig = {
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || 'postgres',
	database: process.env.DB_NAME || 'nextya',
	port: parseInt(process.env.DB_PORT || '5432')
};

// SQL File interface for organized init files
interface SqlFile {
	filename: string;
	order: number;
	content: string;
	description: string;
}

// Create database instance
const db = new Kysely<unknown>({
	dialect: new PostgresDialect({
		pool: new Pool(dbConfig)
	})
});

// Migration provider
const migrationFolder = path.join(process.cwd(), 'src/lib/database/migrations/files');
const migrator = new Migrator({
	db,
	provider: new FileMigrationProvider({
		fs,
		path,
		migrationFolder
	})
});

async function loadSqlFiles(): Promise<SqlFile[]> {
	const initDir = join(process.cwd(), 'database/init');
	try {
		const files = await readdir(initDir);
		const sqlFiles: SqlFile[] = [];

		for (const filename of files.filter((f) => f.endsWith('.sql'))) {
			const content = await readFile(join(initDir, filename), 'utf-8');
			const orderStr = filename.split('-')[0];
			const order = orderStr ? parseInt(orderStr) : 999;

			// Extract description from filename
			const description = filename
				.replace(/^\d+-/, '')
				.replace(/\.sql$/, '')
				.replace(/-/g, ' ')
				.replace(/\b\w/g, (l) => l.toUpperCase());

			sqlFiles.push({
				filename,
				order,
				content: content.trim(),
				description
			});
		}

		return sqlFiles.sort((a, b) => a.order - b.order);
	} catch (error) {
		console.error('❌ Failed to load SQL files:', error);
		return [];
	}
}

async function checkConnection() {
	console.log('🔍 Checking database connection...');
	try {
		await sql`SELECT 1`.execute(db);
		console.log('✅ Database connection successful');
		return true;
	} catch (error) {
		console.error('❌ Database connection failed:', error);
		console.log('💡 Make sure Docker containers are running: docker-compose up -d');
		return false;
	}
}

async function initializeFromSqlFiles(): Promise<boolean> {
	console.log('🚀 Initializing database from SQL files...');

	try {
		const sqlFiles = await loadSqlFiles();
		if (sqlFiles.length === 0) {
			console.log('⚠️ No SQL files found in database/init/');
			return false;
		}

		console.log(`📁 Found ${sqlFiles.length} SQL files to process`);

		// Check if migrations table exists and has any migrations
		try {
			const migrations = await migrator.getMigrations();
			if (migrations.length > 0) {
				console.log('✅ Database already initialized with migrations');
				return true;
			}
		} catch {
			// Migrations table doesn't exist yet, continue with initialization
		}

		// Create initial migration from SQL files
		const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
		const migrationName = `${timestamp}_initial_schema.ts`;
		const migrationPath = join(migrationFolder, migrationName);

		// Ensure migrations directory exists
		await mkdir(migrationFolder, { recursive: true });

		// Combine all SQL files into one migration
		const combinedSql = sqlFiles
			.map((file) => `-- ${file.description} (${file.filename})\n${file.content}`)
			.join('\n\n');

		const migrationContent = `import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	// Initial schema from organized SQL files
	// Generated from: ${sqlFiles.map((f) => f.filename).join(', ')}

	await sql\`${combinedSql.replace(/`/g, '\\`')}\`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Drop all tables in reverse order
	const tables = [
		'student_register_results', 'student_registers', 'eval_results',
		'eval_answers', 'eval_questions', 'eval_sections', 'evals',
		'registers', 'students', 'courses', 'levels', 'permissions', 'users'
	];

	for (const table of tables) {
		await sql\`DROP TABLE IF EXISTS \${sql.identifier([table])} CASCADE\`.execute(db);
	}

	// Drop custom types
	await sql\`DROP TYPE IF EXISTS entity_enum CASCADE\`.execute(db);
}
`;

		await writeFile(migrationPath, migrationContent);
		console.log(`✅ Created initial migration: ${migrationName}`);

		// Run the migration
		const { error } = await migrator.migrateToLatest();
		if (error) {
			console.error('❌ Failed to run initial migration:', error);
			return false;
		}

		console.log('✅ Database initialized successfully from SQL files');
		return true;
	} catch (error) {
		console.error('❌ Failed to initialize from SQL files:', error);
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
		console.log('Usage: npm run db:create "migration_name"');
		return false;
	}

	const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
	const fileName = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.ts`;
	const filePath = join(migrationFolder, fileName);

	// Ensure migrations directory exists
	try {
		await mkdir(migrationFolder, { recursive: true });
	} catch {
		// Directory might already exist
	}

	const template = `import { Kysely, sql } from 'kysely';
		export async function up(db: Kysely<unknown>): Promise<void> {
			// Add your schema changes here
		}

		export async function down(db: Kysely<unknown>): Promise<void> {
			// Add rollback logic here (reverse of up function)
		}
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
		const { error, results } = await migrator.migrateToLatest();

		results?.forEach((it) => {
			if (it.status === 'Success') {
				console.log(`✅ Migration "${it.migrationName}" executed successfully`);
			} else if (it.status === 'Error') {
				console.error(`❌ Failed to execute migration "${it.migrationName}"`);
			}
		});

		if (error) {
			console.error('❌ Migration failed:', error);
			return false;
		}

		console.log('🔄 Regenerating types after migration...');
		await generateTypes();
		return true;
	} catch (error) {
		console.error('❌ Migration failed:', error);
		return false;
	}
}

async function rollbackMigrations() {
	console.log('🔄 Rolling back last migration...');
	try {
		const { error, results } = await migrator.migrateDown();

		results?.forEach((it) => {
			if (it.status === 'Success') {
				console.log(`✅ Migration "${it.migrationName}" rolled back successfully`);
			} else if (it.status === 'Error') {
				console.error(`❌ Failed to rollback migration "${it.migrationName}"`);
			}
		});

		if (error) {
			console.error('❌ Rollback failed:', error);
			return false;
		}

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
		const migrations = await migrator.getMigrations();

		console.log('\n📊 Migration Status');
		console.log('==================');

		if (migrations.length === 0) {
			console.log('No migrations found');
			return true;
		}

		migrations.forEach((migration) => {
			const status = migration.executedAt ? '✅ Executed' : '⏳ Pending';
			const executedInfo = migration.executedAt ? ` (${migration.executedAt.toISOString()})` : '';
			console.log(`  ${status} ${migration.name}${executedInfo}`);
		});

		const executedCount = migrations.filter((m) => m.executedAt).length;
		const pendingCount = migrations.length - executedCount;
		console.log(`\n📈 Summary: ${executedCount} executed, ${pendingCount} pending`);

		return true;
	} catch (error) {
		console.error('❌ Failed to get migration status:', error);
		return false;
	}
}

async function resetDatabase() {
	console.log('🔄 Resetting database (Docker containers)...');
	try {
		const { stderr } = await execAsync('docker-compose down -v && docker-compose up -d');

		if (stderr && !stderr.includes('warning')) {
			console.error('❌ Error resetting database:', stderr);
			return false;
		}

		console.log('✅ Database reset successfully');
		console.log('⏳ Waiting for database to be ready...');

		// Wait a bit for the database to be ready
		await new Promise((resolve) => setTimeout(resolve, 5000));

		console.log('🔄 Regenerating types after reset...');
		await generateTypes();
		return true;
	} catch (error) {
		console.error('❌ Failed to reset database:', error);
		return false;
	}
}

// Clean up database connection
async function cleanup() {
	try {
		await db.destroy();
	} catch {
		// Ignore cleanup errors
	}
}

// Parse command line arguments
const command = process.argv[2];
const migrationName = process.argv[3];

async function main() {
	try {
		switch (command) {
			case 'init':
				if (await checkConnection()) {
					const success = await initializeFromSqlFiles();
					if (success) {
						await generateTypes();
					}
				}
				break;
			case 'migrate':
				if (await checkConnection()) {
					await runMigrations();
				}
				break;
			case 'rollback':
				if (await checkConnection()) {
					await rollbackMigrations();
				}
				break;
			case 'status':
				if (await checkConnection()) {
					await migrationStatus();
				}
				break;
			case 'generate':
				if (await checkConnection()) {
					await generateTypes();
				}
				break;
			case 'create':
				await createMigration(migrationName);
				break;
			case 'reset':
				await resetDatabase();
				break;
			case 'check':
				process.exit((await checkConnection()) ? 0 : 1);
				break;
			case 'check-tables':
				if (await checkConnection()) {
					try {
						const result = await db
							.selectFrom('information_schema.tables')
							.select(db.fn.count('table_name').as('count'))
							.where('table_schema', '=', 'public')
							.executeTakeFirst();
						const hasTable = result && Number(result.count) > 0;
						console.log(hasTable);
						process.exit(0);
					} catch {
						console.log(false);
						process.exit(0);
					}
				} else {
					console.log(false);
					process.exit(1);
				}
				break;
			default:
				console.log('NextYa Database Migration CLI - Unified System');
				console.log('==============================================');
				console.log('Usage: npm run db:[command]');
				console.log('');
				console.log('Commands:');
				console.log('  db:init        Initialize database from SQL files (first time)');
				console.log('  db:migrate     Run pending migrations');
				console.log('  db:rollback    Rollback last migration');
				console.log('  db:status      Show migration status');
				console.log('  db:generate    Generate TypeScript types');
				console.log('  db:create      Create new migration file');
				console.log('  db:reset       Reset database (Docker)');
				console.log('');
				console.log('🚀 Quick Start:');
				console.log('  npm run db:init     # First time setup from your SQL files');
				console.log('  npm run db:create   # Create new migration for changes');
				console.log('  npm run db:migrate  # Apply new migrations');
				break;
		}
	} finally {
		await cleanup();
	}
}

main().catch(console.error);
