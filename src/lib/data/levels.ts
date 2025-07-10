import { sql } from 'kysely';
import type { Levels } from '$lib/types';
import type { Database } from '$lib/database';

const levelsCache = new Map<string, { data: Levels[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

export async function getLevels(
	db: Database,
	userCode: string,
	forceRefresh = false
): Promise<Levels[]> {
	try {
		// Si no hay forzado de actualización y existe caché válida, usarla
		if (!forceRefresh && levelsCache.has(userCode)) {
			const cache = levelsCache.get(userCode)!;
			const now = Date.now();

			// Si la caché no ha expirado, retornar datos en caché
			if (now - cache.timestamp < CACHE_TTL) {
				return cache.data;
			}
		}

		// Obtener datos frescos usando Kysely
		// PostgreSQL array contains operator @>
		const dbLevels = await db
			.selectFrom('levels')
			.select(['code', 'name', 'abr', 'created_at', 'users'])
			.where(sql<boolean>`${userCode} = ANY(users)`)
			.execute();

		const levels = dbLevels;

		// Actualizar caché
		if (levels && levels.length > 0) {
			levelsCache.set(userCode, {
				data: levels,
				timestamp: Date.now()
			});
		}

		return levels;
	} catch {
		return [];
	}
}
