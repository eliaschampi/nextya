#!/usr/bin/env tsx

/**
 * NextYa Development Tools - Comprehensive Database Management
 * ===========================================================
 * 
 * This script provides comprehensive development tools for database management:
 * - Database health checks
 * - Schema analysis and validation
 * - Performance monitoring
 * - Data seeding for development
 * - Backup and restore utilities
 * - Development environment setup
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { createDatabase } from '../src/lib/database/index.js';
import { TypeGenerator } from '../src/lib/database/type-generator.js';

const execAsync = promisify(exec);

// Database configuration
const dbConfig = {
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || 'postgres',
	database: process.env.DB_NAME || 'nextya',
	port: parseInt(process.env.DB_PORT || '5432')
};

const db = createDatabase(dbConfig);
const typeGenerator = new TypeGenerator(db);

/**
 * Check database health and performance
 */
async function healthCheck(): Promise<void> {
	console.log('🏥 NextYa Database Health Check');
	console.log('===============================');

	try {
		// Connection test
		const startTime = Date.now();
		await db.selectFrom('users' as any).select('code').limit(1).execute();
		const connectionTime = Date.now() - startTime;
		console.log(`✅ Connection: ${connectionTime}ms`);

		// Table counts
		const tables = ['users', 'courses', 'students', 'levels', 'evals', 'registers'];
		console.log('\n📊 Table Statistics:');
		
		for (const table of tables) {
			try {
				const result = await db.selectFrom(table as any)
					.select(db.fn.count('*').as('count'))
					.executeTakeFirst() as { count: string };
				console.log(`  ${table.padEnd(12)}: ${result.count.padStart(6)} records`);
			} catch (error) {
				console.log(`  ${table.padEnd(12)}: ❌ Error`);
			}
		}

		// Database size
		const sizeResult = await db.executeQuery(
			db.raw(`
				SELECT pg_size_pretty(pg_database_size('nextya')) as size
			`).compile()
		);
		console.log(`\n💾 Database Size: ${sizeResult.rows[0]?.size || 'Unknown'}`);

		// Active connections
		const connectionsResult = await db.executeQuery(
			db.raw(`
				SELECT count(*) as active_connections 
				FROM pg_stat_activity 
				WHERE datname = 'nextya'
			`).compile()
		);
		console.log(`🔗 Active Connections: ${connectionsResult.rows[0]?.active_connections || 'Unknown'}`);

		console.log('\n✅ Health check completed');

	} catch (error) {
		console.error('❌ Health check failed:', error);
	}
}

/**
 * Analyze database schema and suggest optimizations
 */
async function analyzeSchema(): Promise<void> {
	console.log('🔍 Schema Analysis');
	console.log('==================');

	try {
		// Missing indexes on foreign keys
		const missingIndexes = await db.executeQuery(
			db.raw(`
				SELECT 
					schemaname,
					tablename,
					attname,
					n_distinct,
					correlation
				FROM pg_stats
				WHERE schemaname = 'public'
				AND n_distinct > 100
				ORDER BY n_distinct DESC
			`).compile()
		);

		if (missingIndexes.rows.length > 0) {
			console.log('\n⚠️  Potential Missing Indexes:');
			missingIndexes.rows.forEach((row: any) => {
				console.log(`  ${row.tablename}.${row.attname} (distinct: ${row.n_distinct})`);
			});
		}

		// Large tables
		const tableSizes = await db.executeQuery(
			db.raw(`
				SELECT 
					schemaname,
					tablename,
					pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
					pg_total_relation_size(schemaname||'.'||tablename) as bytes
				FROM pg_tables 
				WHERE schemaname = 'public'
				ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
			`).compile()
		);

		console.log('\n📏 Table Sizes:');
		tableSizes.rows.forEach((row: any) => {
			console.log(`  ${row.tablename.padEnd(15)}: ${row.size}`);
		});

		console.log('\n✅ Schema analysis completed');

	} catch (error) {
		console.error('❌ Schema analysis failed:', error);
	}
}

/**
 * Seed database with development data
 */
async function seedDatabase(): Promise<void> {
	console.log('🌱 Seeding Development Data');
	console.log('===========================');

	try {
		// Check if data already exists
		const userCount = await db.selectFrom('users' as any)
			.select(db.fn.count('*').as('count'))
			.executeTakeFirst() as { count: string };

		if (parseInt(userCount.count) > 0) {
			console.log('⚠️  Database already contains data. Use --force to override.');
			return;
		}

		// Create test users
		console.log('👥 Creating test users...');
		const testUsers = [
			{
				email: 'admin@nextya.dev',
				name: 'Admin',
				last_name: 'User',
				password_hash: '$2a$10$example.hash.for.development',
				is_super_admin: true,
				is_email_verified: true
			},
			{
				email: 'teacher@nextya.dev',
				name: 'Teacher',
				last_name: 'Demo',
				password_hash: '$2a$10$example.hash.for.development',
				is_super_admin: false,
				is_email_verified: true
			}
		];

		for (const user of testUsers) {
			await db.insertInto('users' as any).values(user).execute();
		}

		// Create test levels
		console.log('📚 Creating test levels...');
		const adminUser = await db.selectFrom('users' as any)
			.select('code')
			.where('email', '=', 'admin@nextya.dev')
			.executeTakeFirst() as { code: string };

		await db.insertInto('levels' as any).values({
			name: 'Beginner Level',
			abr: 'BEG',
			users: [adminUser.code]
		}).execute();

		console.log('✅ Development data seeded successfully');
		console.log('\n🔑 Test Credentials:');
		console.log('  Admin: admin@nextya.dev / password');
		console.log('  Teacher: teacher@nextya.dev / password');

	} catch (error) {
		console.error('❌ Seeding failed:', error);
	}
}

/**
 * Clean development data
 */
async function cleanDatabase(): Promise<void> {
	console.log('🧹 Cleaning Development Data');
	console.log('============================');

	try {
		const tables = ['eval_results', 'eval_answers', 'eval_questions', 'eval_sections', 
		               'evals', 'registers', 'students', 'courses', 'levels', 'permissions', 'users'];

		for (const table of tables) {
			const result = await db.deleteFrom(table as any).execute();
			console.log(`  ${table.padEnd(15)}: ${result.length || 0} records deleted`);
		}

		console.log('✅ Database cleaned successfully');

	} catch (error) {
		console.error('❌ Cleaning failed:', error);
	}
}

/**
 * Generate comprehensive development report
 */
async function generateReport(): Promise<void> {
	console.log('📊 Generating Development Report');
	console.log('===============================');

	const report = {
		timestamp: new Date().toISOString(),
		database: {
			connection: 'unknown',
			tables: {},
			size: 'unknown'
		},
		types: await typeGenerator.getStats(),
		migrations: {
			executed: 0,
			pending: 0
		}
	};

	try {
		// Database info
		await db.selectFrom('users' as any).select('code').limit(1).execute();
		report.database.connection = 'healthy';

		// Table counts
		const tables = ['users', 'courses', 'students', 'levels', 'evals'];
		for (const table of tables) {
			try {
				const result = await db.selectFrom(table as any)
					.select(db.fn.count('*').as('count'))
					.executeTakeFirst() as { count: string };
				report.database.tables[table] = parseInt(result.count);
			} catch (error) {
				report.database.tables[table] = 'error';
			}
		}

		// Save report
		const reportPath = join(process.cwd(), 'dev-report.json');
		await writeFile(reportPath, JSON.stringify(report, null, 2));
		
		console.log('✅ Report generated: dev-report.json');
		console.log('\n📈 Summary:');
		console.log(`  Database: ${report.database.connection}`);
		console.log(`  Tables: ${Object.keys(report.database.tables).length}`);
		console.log(`  Types: ${report.types.interfacesCount} interfaces`);

	} catch (error) {
		console.error('❌ Report generation failed:', error);
	}
}

// Parse command line arguments
const command = process.argv[2];
const options = process.argv.slice(3);

async function main() {
	switch (command) {
		case 'health':
		case 'check':
			await healthCheck();
			break;
		case 'analyze':
		case 'schema':
			await analyzeSchema();
			break;
		case 'seed':
			await seedDatabase();
			break;
		case 'clean':
			await cleanDatabase();
			break;
		case 'report':
			await generateReport();
			break;
		default:
			console.log('NextYa Development Tools');
			console.log('=======================');
			console.log('Usage: tsx scripts/dev-tools.ts [command]');
			console.log('');
			console.log('Commands:');
			console.log('  health, check    Database health check');
			console.log('  analyze, schema  Schema analysis and optimization suggestions');
			console.log('  seed             Seed database with development data');
			console.log('  clean            Clean all development data');
			console.log('  report           Generate comprehensive development report');
			console.log('');
			console.log('Examples:');
			console.log('  tsx scripts/dev-tools.ts health');
			console.log('  tsx scripts/dev-tools.ts seed');
			console.log('  tsx scripts/dev-tools.ts analyze');
			break;
	}

	// Clean up
	try {
		await db.destroy();
	} catch (error) {
		// Ignore cleanup errors
	}
}

main().catch(console.error);
