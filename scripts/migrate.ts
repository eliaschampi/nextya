import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { Kysely, PostgresDialect, Migrator, FileMigrationProvider } from 'kysely';
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

async function checkConnection() {
	console.log('🔍 Checking database connection...');
	try {
		await db.executeQuery('SELECT 1' as any);
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
			default:
				console.log('NextYa Database Migration CLI');
				console.log('============================');
				console.log('Usage: npm run db:[command]');
				console.log('');
				console.log('Commands:');
				console.log('  db:migrate     Run pending migrations');
				console.log('  db:rollback    Rollback last migration');
				console.log('  db:status      Show migration status');
				console.log('  db:generate    Generate TypeScript types');
				console.log('  db:create      Create new migration file');
				console.log('  db:reset       Reset database (Docker)');
				break;
		}
	} finally {
		await cleanup();
	}
}

main().catch(console.error);
