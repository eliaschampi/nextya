import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';

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

interface SqlFile {
	filename: string;
	order: number;
	content: string;
	description: string;
}

async function loadSqlFiles(): Promise<SqlFile[]> {
	const initDir = join(process.cwd(), 'database/init');
	const files = await readdir(initDir);
	
	const sqlFiles: SqlFile[] = [];
	
	for (const filename of files.filter(f => f.endsWith('.sql'))) {
		const content = await readFile(join(initDir, filename), 'utf-8');
		const order = parseInt(filename.split('-')[0]) || 999;
		
		// Extract description from filename
		const description = filename
			.replace(/^\d+-/, '')
			.replace(/\.sql$/, '')
			.replace(/-/g, ' ')
			.replace(/\b\w/g, l => l.toUpperCase());
		
		sqlFiles.push({
			filename,
			order,
			content: content.trim(),
			description
		});
	}
	
	return sqlFiles.sort((a, b) => a.order - b.order);
}

async function createMigrationFromSqlFile(sqlFile: SqlFile): Promise<void> {
	console.log(`🔄 Processing: ${sqlFile.filename} - ${sqlFile.description}`);
	
	try {
		// Execute the SQL content
		await sql`${sql.raw(sqlFile.content)}`.execute(db);
		console.log(`✅ Successfully executed: ${sqlFile.filename}`);
	} catch (error) {
		console.error(`❌ Failed to execute ${sqlFile.filename}:`, error);
		throw error;
	}
}

async function migrateSqlFiles(): Promise<void> {
	console.log('🚀 Starting SQL file migration...');
	
	try {
		const sqlFiles = await loadSqlFiles();
		console.log(`📁 Found ${sqlFiles.length} SQL files to process`);
		
		for (const sqlFile of sqlFiles) {
			await createMigrationFromSqlFile(sqlFile);
		}
		
		console.log('✅ All SQL files migrated successfully!');
	} catch (error) {
		console.error('❌ Migration failed:', error);
		throw error;
	}
}

async function createKyselyMigrationFromSql(sqlFile: SqlFile): Promise<string> {
	const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
	const migrationName = `${timestamp}_${sqlFile.filename.replace('.sql', '').replace(/\W+/g, '_')}`;
	
	// Create migration content
	const migrationContent = `import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
	// ${sqlFile.description}
	// Source: ${sqlFile.filename}
	
	await sql\`${sqlFile.content.replace(/`/g, '\\`')}\`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// This migration contains complex schema changes from ${sqlFile.filename}
	// Manual rollback implementation required based on the specific changes
	throw new Error('Manual rollback required for ${sqlFile.filename}');
}
`;

	return migrationContent;
}

async function generateKyselyMigrations(): Promise<void> {
	console.log('🔄 Generating Kysely migrations from SQL files...');
	
	try {
		const sqlFiles = await loadSqlFiles();
		const migrationsDir = join(process.cwd(), 'src/lib/database/migrations/files');
		
		// Ensure migrations directory exists
		const { mkdir } = await import('fs/promises');
		await mkdir(migrationsDir, { recursive: true });
		
		for (const sqlFile of sqlFiles) {
			const migrationContent = await createKyselyMigrationFromSql(sqlFile);
			const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
			const filename = `${timestamp}_${sqlFile.filename.replace('.sql', '').replace(/\W+/g, '_')}.ts`;
			const filePath = join(migrationsDir, filename);
			
			const { writeFile } = await import('fs/promises');
			await writeFile(filePath, migrationContent);
			console.log(`✅ Generated migration: ${filename}`);
		}
		
		console.log('✅ All Kysely migrations generated successfully!');
	} catch (error) {
		console.error('❌ Failed to generate migrations:', error);
		throw error;
	}
}

async function checkConnection(): Promise<boolean> {
	console.log('🔍 Checking database connection...');
	try {
		await db.executeQuery('SELECT 1' as any);
		console.log('✅ Database connection successful');
		return true;
	} catch (error) {
		console.error('❌ Database connection failed:', error);
		return false;
	}
}

async function cleanup(): Promise<void> {
	try {
		await db.destroy();
	} catch {
		// Ignore cleanup errors
	}
}

// Parse command line arguments
const command = process.argv[2];

async function main() {
	try {
		switch (command) {
			case 'migrate':
				if (await checkConnection()) {
					await migrateSqlFiles();
				}
				break;
			case 'generate':
				await generateKyselyMigrations();
				break;
			case 'list':
				const sqlFiles = await loadSqlFiles();
				console.log('\n📋 SQL Files Found:');
				console.log('==================');
				sqlFiles.forEach(file => {
					console.log(`${file.order.toString().padStart(2, '0')}. ${file.filename} - ${file.description}`);
				});
				break;
			default:
				console.log('NextYa SQL Migration Utility');
				console.log('============================');
				console.log('Usage: npm run sql:[command]');
				console.log('');
				console.log('Commands:');
				console.log('  sql:migrate    Execute SQL files directly to database');
				console.log('  sql:generate   Generate Kysely migrations from SQL files');
				console.log('  sql:list       List all SQL files in order');
				break;
		}
	} finally {
		await cleanup();
	}
}

main().catch(console.error);
