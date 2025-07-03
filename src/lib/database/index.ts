import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { DB } from './types';
import { dev } from '$app/environment';
import { dbConfig } from '$lib/config/server';

// Create connection pool
const pool = new Pool({
	...dbConfig,
	max: dev ? 10 : 20,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 10000 // Increased from 2000 to 10000
});

// Single database instance - used only in hooks.server.ts
export const db = new Kysely<DB>({
	dialect: new PostgresDialect({ pool }),
	log: (event) => {
		if (dev && event.level === 'query') {
			console.log('SQL:', event.query.sql);
			console.log('Parameters:', event.query.parameters);
		}
	}
});

export type Database = typeof db;

// Graceful shutdown
process.on('SIGTERM', async () => {
	console.log('Closing database pool...');
	await pool.end();
});
