#!/usr/bin/env tsx

/**
 * NextYa Development Tools - Simple Database Management
 * ====================================================
 *
 * This script provides essential development tools for database management:
 * - Database health checks
 * - Data seeding for development
 * - Data cleanup
 */

import { createDatabase } from '../src/lib/database/index.js';
import type { DB } from '../src/lib/database/types.js';
import { sql } from 'kysely';

// Database configuration
const dbConfig = {
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASSWORD || 'postgres',
	database: process.env.DB_NAME || 'nextya',
	port: parseInt(process.env.DB_PORT || '5432')
};

const db = createDatabase(dbConfig);

/**
 * Check database health and performance
 */
async function healthCheck(): Promise<void> {
	console.log('🏥 NextYa Database Health Check');
	console.log('===============================');

	try {
		// Connection test
		const startTime = Date.now();
		await db.selectFrom('users').select('code').limit(1).execute();
		const connectionTime = Date.now() - startTime;
		console.log(`✅ Connection: ${connectionTime}ms`);

		// Table counts
		const tables: (keyof DB)[] = ['users', 'courses', 'students', 'levels', 'evals', 'registers'];
		console.log('\n📊 Table Statistics:');

		for (const table of tables) {
			try {
				const result = await sql<{
					count: number;
				}>`SELECT COUNT(*) as count FROM ${sql.table(table)}`.execute(db);
				const count = result.rows[0]?.count || 0;
				console.log(`  ${table.padEnd(12)}: ${count.toString().padStart(6)} records`);
			} catch {
				console.log(`  ${table.padEnd(12)}: ❌ Error`);
			}
		}

		console.log('\n✅ Health check completed');
	} catch (error) {
		console.error('❌ Health check failed:', error);
	}
}

/**
 * Show basic database information
 */
async function showInfo(): Promise<void> {
	console.log('ℹ️  NextYa Database Information');
	console.log('==============================');

	try {
		// Show table list
		const tables: (keyof DB)[] = ['users', 'courses', 'students', 'levels', 'evals', 'registers'];
		console.log('\n📋 Available Tables:');

		for (const table of tables) {
			console.log(`  • ${table}`);
		}

		console.log('\n✅ Database information displayed');
	} catch (error) {
		console.error('❌ Failed to show database info:', error);
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
		const userCount = await db
			.selectFrom('users')
			.select((eb) => eb.fn.countAll().as('count'))
			.executeTakeFirst();

		if (userCount && parseInt(userCount.count.toString()) > 0) {
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
			await db.insertInto('users').values(user).execute();
		}

		// Create test levels
		console.log('📚 Creating test levels...');
		const adminUser = await db
			.selectFrom('users')
			.select('code')
			.where('email', '=', 'admin@nextya.dev')
			.executeTakeFirst();

		if (adminUser) {
			await db
				.insertInto('levels')
				.values({
					name: 'Beginner Level',
					abr: 'BEG',
					users: [adminUser.code]
				})
				.execute();
		}

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
		const tables: (keyof DB)[] = [
			'eval_results',
			'eval_answers',
			'eval_questions',
			'eval_sections',
			'evals',
			'registers',
			'students',
			'courses',
			'levels',
			'permissions',
			'users'
		];

		for (const table of tables) {
			try {
				const result = await db.deleteFrom(table).execute();
				console.log(`  ${table.padEnd(15)}: ${result.length || 0} records deleted`);
			} catch {
				console.log(`  ${table.padEnd(15)}: ❌ Error deleting`);
			}
		}

		console.log('✅ Database cleaned successfully');
	} catch (error) {
		console.error('❌ Cleaning failed:', error);
	}
}

// Parse command line arguments
const command = process.argv[2];

async function main() {
	switch (command) {
		case 'health':
		case 'check':
			await healthCheck();
			break;
		case 'info':
			await showInfo();
			break;
		case 'seed':
			await seedDatabase();
			break;
		case 'clean':
			await cleanDatabase();
			break;
		default:
			console.log('NextYa Development Tools');
			console.log('=======================');
			console.log('Usage: tsx scripts/dev-tools.ts [command]');
			console.log('');
			console.log('Commands:');
			console.log('  health, check    Database health check');
			console.log('  info             Show database information');
			console.log('  seed             Seed database with development data');
			console.log('  clean            Clean all development data');
			console.log('');
			console.log('Examples:');
			console.log('  tsx scripts/dev-tools.ts health');
			console.log('  tsx scripts/dev-tools.ts seed');
			console.log('  tsx scripts/dev-tools.ts clean');
			break;
	}

	// Clean up
	try {
		await db.destroy();
	} catch {
		// Ignore cleanup errors
	}
}

main().catch(console.error);
