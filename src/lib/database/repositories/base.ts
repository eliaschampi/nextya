/**
 * BASE REPOSITORY - Simplified Clean Architecture
 *
 * ARCHITECTURE PRINCIPLE: Simple, functional, type-safe
 * Provides common database operations with minimal complexity
 */

import { db } from '$lib/database';

// ============================================================================
// SIMPLIFIED BASE REPOSITORY - Functional approach
// ============================================================================

export abstract class BaseRepository {
	constructor(protected readonly tableName: string) {}

	/**
	 * Get database instance for custom queries
	 */
	protected get db() {
		return db;
	}

	/**
	 * Log errors consistently
	 */
	protected logError(operation: string, error: any) {
		console.error(`Error in ${this.tableName} ${operation}:`, error);
	}
}
