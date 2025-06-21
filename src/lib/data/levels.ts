import { sql } from 'kysely';
import { db } from '$lib/database';

const levelsCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

export async function getLevels(userID: string, forceRefresh = false): Promise<any[]> {
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
		const levels = await db
			.selectFrom('levels')
			.select(['code', 'name', 'abr', 'created_at', 'users'])
			.where(sql<boolean>`users @> ${JSON.stringify([userID])}`)
			.execute();

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
