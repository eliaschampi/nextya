/**
 * NextYa Migration System - Clean Architecture
 * ============================================
 *
 * This system provides a solid foundation for database migrations with:
 * - Version control for schema changes
 * - Rollback capabilities
 * - Type-safe migrations
 * - Automatic type generation after migrations
 *
 * Architecture:
 * - Each migration is a TypeScript file with up/down functions
 * - Migrations are tracked in a migrations table
 * - Schema changes are applied incrementally
 * - Types are regenerated automatically after successful migrations
 */

import { Kysely, sql } from 'kysely';
import type { Database } from '../index';
import { readdir } from 'fs/promises';
import { join } from 'path';

export interface Migration {
	id: string;
	name: string;
	up: (db: Kysely<any>) => Promise<void>;
	down: (db: Kysely<any>) => Promise<void>;
}

export interface MigrationRecord {
	id: string;
	name: string;
	executed_at: Date;
	batch: number;
}

export class MigrationRunner {
	constructor(private db: Database) {}

	/**
	 * Initialize the migrations table if it doesn't exist
	 */
	async initialize(): Promise<void> {
		await this.db.schema
			.createTable('_migrations')
			.ifNotExists()
			.addColumn('id', 'varchar(255)', (col) => col.primaryKey())
			.addColumn('name', 'varchar(255)', (col) => col.notNull())
			.addColumn('executed_at', 'timestamptz', (col) =>
				col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
			)
			.addColumn('batch', 'integer', (col) => col.notNull())
			.execute();
	}

	/**
	 * Get all executed migrations
	 */
	async getExecutedMigrations(): Promise<MigrationRecord[]> {
		try {
			return (await this.db
				.selectFrom('_migrations' as any)
				.selectAll()
				.orderBy('executed_at', 'asc')
				.execute()) as MigrationRecord[];
		} catch (error) {
			// Table doesn't exist yet
			return [];
		}
	}

	/**
	 * Get the next batch number
	 */
	async getNextBatch(): Promise<number> {
		const result = (await this.db
			.selectFrom('_migrations' as any)
			.select(sql<number>`COALESCE(MAX(batch), 0) + 1`.as('next_batch'))
			.executeTakeFirst()) as { next_batch: number } | undefined;

		return result?.next_batch || 1;
	}

	/**
	 * Load all migration files from the migrations directory
	 */
	async loadMigrations(): Promise<Migration[]> {
		const migrationsDir = join(process.cwd(), 'src/lib/database/migrations/files');

		try {
			const files = await readdir(migrationsDir);
			const migrationFiles = files
				.filter((file) => file.endsWith('.ts') && file !== 'index.ts')
				.sort();

			const migrations: Migration[] = [];

			for (const file of migrationFiles) {
				const migrationModule = await import(join(migrationsDir, file));
				const migration = migrationModule.default || migrationModule;

				if (
					migration &&
					typeof migration.up === 'function' &&
					typeof migration.down === 'function'
				) {
					migrations.push({
						id: file.replace('.ts', ''),
						name: migration.name || file.replace('.ts', ''),
						up: migration.up,
						down: migration.down
					});
				}
			}

			return migrations;
		} catch (error) {
			console.warn('No migrations directory found or error loading migrations:', error);
			return [];
		}
	}

	/**
	 * Run pending migrations
	 */
	async migrate(): Promise<void> {
		await this.initialize();

		const executedMigrations = await this.getExecutedMigrations();
		const allMigrations = await this.loadMigrations();
		const executedIds = new Set(executedMigrations.map((m) => m.id));

		const pendingMigrations = allMigrations.filter((m) => !executedIds.has(m.id));

		if (pendingMigrations.length === 0) {
			console.log('✅ No pending migrations');
			return;
		}

		const batch = await this.getNextBatch();

		console.log(`🔄 Running ${pendingMigrations.length} migration(s) in batch ${batch}...`);

		for (const migration of pendingMigrations) {
			console.log(`  ⏳ Running migration: ${migration.name}`);

			try {
				await migration.up(this.db);

				await this.db
					.insertInto('_migrations' as any)
					.values({
						id: migration.id,
						name: migration.name,
						executed_at: new Date(),
						batch
					})
					.execute();

				console.log(`  ✅ Migration completed: ${migration.name}`);
			} catch (error) {
				console.error(`  ❌ Migration failed: ${migration.name}`, error);
				throw error;
			}
		}

		console.log('✅ All migrations completed successfully');
	}

	/**
	 * Rollback the last batch of migrations
	 */
	async rollback(): Promise<void> {
		await this.initialize();

		const executedMigrations = await this.getExecutedMigrations();

		if (executedMigrations.length === 0) {
			console.log('✅ No migrations to rollback');
			return;
		}

		const lastBatch = Math.max(...executedMigrations.map((m) => m.batch));
		const migrationsToRollback = executedMigrations.filter((m) => m.batch === lastBatch).reverse(); // Rollback in reverse order

		const allMigrations = await this.loadMigrations();
		const migrationMap = new Map(allMigrations.map((m) => [m.id, m]));

		console.log(
			`🔄 Rolling back ${migrationsToRollback.length} migration(s) from batch ${lastBatch}...`
		);

		for (const migrationRecord of migrationsToRollback) {
			const migration = migrationMap.get(migrationRecord.id);

			if (!migration) {
				console.warn(`  ⚠️  Migration file not found: ${migrationRecord.name}`);
				continue;
			}

			console.log(`  ⏳ Rolling back migration: ${migration.name}`);

			try {
				await migration.down(this.db);

				await this.db
					.deleteFrom('_migrations' as any)
					.where('id', '=', migration.id)
					.execute();

				console.log(`  ✅ Migration rolled back: ${migration.name}`);
			} catch (error) {
				console.error(`  ❌ Rollback failed: ${migration.name}`, error);
				throw error;
			}
		}

		console.log('✅ Rollback completed successfully');
	}

	/**
	 * Get migration status
	 */
	async status(): Promise<void> {
		await this.initialize();

		const executedMigrations = await this.getExecutedMigrations();
		const allMigrations = await this.loadMigrations();
		const executedIds = new Set(executedMigrations.map((m) => m.id));

		console.log('\n📊 Migration Status');
		console.log('==================');

		if (allMigrations.length === 0) {
			console.log('No migrations found');
			return;
		}

		for (const migration of allMigrations) {
			const isExecuted = executedIds.has(migration.id);
			const status = isExecuted ? '✅ Executed' : '⏳ Pending';
			const executedInfo = isExecuted
				? ` (batch ${executedMigrations.find((m) => m.id === migration.id)?.batch})`
				: '';

			console.log(`  ${status} ${migration.name}${executedInfo}`);
		}

		const pendingCount = allMigrations.length - executedMigrations.length;
		console.log(`\n📈 Summary: ${executedMigrations.length} executed, ${pendingCount} pending`);
	}
}
