/**
 * Enhanced Type Generation System for NextYa
 * ==========================================
 *
 * This module provides enhanced type generation with:
 * - Schema validation before type generation
 * - Backup of existing types
 * - Rollback capabilities
 * - Enhanced error handling
 * - Type validation after generation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, copyFile, access } from 'fs/promises';
import { join } from 'path';
import type { Database } from './index';

const execAsync = promisify(exec);

export class TypeGenerator {
	constructor(private db: Database) {}

	/**
	 * Validate database schema before type generation
	 */
	async validateSchema(): Promise<{ isValid: boolean; issues: string[] }> {
		const issues: string[] = [];

		try {
			// Check if essential tables exist
			const tables = await this.db.introspection.getTables();
			const tableNames = tables.map((t) => t.name);

			const requiredTables = ['users', 'courses', 'students', 'levels'];
			for (const table of requiredTables) {
				if (!tableNames.includes(table)) {
					issues.push(`Missing required table: ${table}`);
				}
			}

			// Check for foreign key consistency
			// Note: getMetadata() is deprecated, but we'll keep basic validation
			await this.db.introspection.getMetadata();
			// Add specific validation logic here if needed

			// Check for proper indexes on foreign keys
			// This would require custom queries to check index existence
		} catch (error) {
			issues.push(`Schema validation error: ${error}`);
		}

		return {
			isValid: issues.length === 0,
			issues
		};
	}

	/**
	 * Backup existing types file
	 */
	async backupTypes(): Promise<string | null> {
		const typesPath = join(process.cwd(), 'src/lib/database/types.ts');
		const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
		const backupPath = join(process.cwd(), 'src/lib/database', `types.backup.${timestamp}.ts`);

		try {
			await access(typesPath);
			await copyFile(typesPath, backupPath);
			console.log(`📦 Types backed up to: types.backup.${timestamp}.ts`);
			return backupPath;
		} catch {
			// File doesn't exist, no backup needed
			return null;
		}
	}

	/**
	 * Validate generated types file
	 */
	async validateGeneratedTypes(): Promise<{ isValid: boolean; issues: string[] }> {
		const issues: string[] = [];
		const typesPath = join(process.cwd(), 'src/lib/database/types.ts');

		try {
			const content = await readFile(typesPath, 'utf-8');

			// Check for essential exports
			const requiredExports = ['DB', 'Users', 'Courses', 'Students', 'Levels'];
			for (const exportName of requiredExports) {
				if (!content.includes(`export interface ${exportName}`)) {
					issues.push(`Missing interface: ${exportName}`);
				}
			}

			// Check for TypeScript syntax errors (basic check)
			if (content.includes('export interface DB {') && !content.includes('}')) {
				issues.push('Malformed DB interface');
			}

			// Check for proper imports
			if (!content.includes("import type { ColumnType } from 'kysely'")) {
				issues.push('Missing Kysely imports');
			}
		} catch (error) {
			issues.push(`Type validation error: ${error}`);
		}

		return {
			isValid: issues.length === 0,
			issues
		};
	}

	/**
	 * Generate types with enhanced error handling and validation
	 */
	async generateTypes(): Promise<{
		success: boolean;
		backupPath?: string | null;
		issues?: string[];
	}> {
		console.log('🔍 Validating database schema...');

		// Step 1: Validate schema
		const schemaValidation = await this.validateSchema();
		if (!schemaValidation.isValid) {
			console.error('❌ Schema validation failed:');
			schemaValidation.issues.forEach((issue) => console.error(`  • ${issue}`));
			return { success: false, issues: schemaValidation.issues };
		}
		console.log('✅ Schema validation passed');

		// Step 2: Backup existing types
		console.log('📦 Backing up existing types...');
		const backupPath = await this.backupTypes();

		// Step 3: Generate new types
		console.log('🔄 Generating TypeScript types...');
		try {
			const { stdout, stderr } = await execAsync('npm run db:generate');

			if (stderr && !stderr.includes('warning') && !stderr.includes('npm WARN')) {
				throw new Error(`Type generation failed: ${stderr}`);
			}

			console.log('✅ Types generated successfully');
			if (stdout && !stdout.includes('npm WARN')) {
				console.log(stdout);
			}
		} catch (error) {
			console.error('❌ Type generation failed:', error);

			// Restore backup if available
			if (backupPath) {
				try {
					const typesPath = join(process.cwd(), 'src/lib/database/types.ts');
					await copyFile(backupPath, typesPath);
					console.log('🔄 Restored types from backup');
				} catch (restoreError) {
					console.error('❌ Failed to restore backup:', restoreError);
				}
			}

			const errorMessage = error instanceof Error ? error.message : String(error);
			return { success: false, backupPath, issues: [errorMessage] };
		}

		// Step 4: Validate generated types
		console.log('🔍 Validating generated types...');
		const typeValidation = await this.validateGeneratedTypes();
		if (!typeValidation.isValid) {
			console.error('❌ Generated types validation failed:');
			typeValidation.issues.forEach((issue) => console.error(`  • ${issue}`));

			// Restore backup if available
			if (backupPath) {
				try {
					const typesPath = join(process.cwd(), 'src/lib/database/types.ts');
					await copyFile(backupPath, typesPath);
					console.log('🔄 Restored types from backup due to validation failure');
				} catch (restoreError) {
					console.error('❌ Failed to restore backup:', restoreError);
				}
			}

			return { success: false, backupPath, issues: typeValidation.issues };
		}

		console.log('✅ Type validation passed');
		console.log('🎉 Type generation completed successfully');

		return { success: true, backupPath };
	}

	/**
	 * Get type generation statistics
	 */
	async getStats(): Promise<{
		tablesCount: number;
		interfacesCount: number;
		lastGenerated?: Date;
		fileSize: number;
	}> {
		const typesPath = join(process.cwd(), 'src/lib/database/types.ts');

		try {
			const content = await readFile(typesPath, 'utf-8');
			const stats = await import('fs').then((fs) => fs.promises.stat(typesPath));

			// Count interfaces
			const interfaceMatches = content.match(/export interface \w+/g) || [];
			const interfacesCount = interfaceMatches.length;

			// Get table count from DB interface
			const dbInterfaceMatch = content.match(/export interface DB \{([\s\S]*?)\}/);
			const tablesCount = dbInterfaceMatch ? (dbInterfaceMatch[1].match(/\w+:/g) || []).length : 0;

			return {
				tablesCount,
				interfacesCount,
				lastGenerated: stats.mtime,
				fileSize: stats.size
			};
		} catch {
			return {
				tablesCount: 0,
				interfacesCount: 0,
				fileSize: 0
			};
		}
	}
}
