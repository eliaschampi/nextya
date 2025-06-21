import { sql } from 'kysely';
import { db } from '$lib/database';
import type { Levels } from '$lib/types';
import { transformLevels } from '$lib/utils';

const levelsCache = new Map<string, { data: Levels[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

export async function getLevels(userID: string, forceRefresh = false): Promise<Levels[]> {
	try {
		// Si no hay forzado de actualización y existe caché válida, usarla
		if (!forceRefresh && levelsCache.has(userID)) {
			const cache = levelsCache.get(userID)!;
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
			.where(sql<boolean>`users @> ${JSON.stringify([userID])}`)
			.execute();

		const levels = transformLevels(dbLevels);

		// Actualizar caché
		if (levels && levels.length > 0) {
			levelsCache.set(userID, {
				data: levels,
				timestamp: Date.now()
			});
		}

		return levels;
	} catch {
		return [];
	}
}
