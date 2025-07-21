import { sql } from 'kysely';
import type { Levels } from '$lib/types';
import type { Database } from '$lib/database';

export async function getLevels(db: Database, userCode: string): Promise<Levels[]> {
	try {
		return await db
			.selectFrom('levels')
			.select(['code', 'name', 'abr', 'created_at', 'users'])
			.where(sql<boolean>`${userCode} = ANY(users)`)
			.execute();
	} catch {
		return [];
	}
}
