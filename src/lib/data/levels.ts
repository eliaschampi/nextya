import type { SupabaseClient } from '@supabase/supabase-js';

import type { Level } from '$lib/types';

// Cache para almacenar niveles por usuario
const levelsCache = new Map<string, { data: Level[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

/**
 * Obtiene los niveles disponibles para un usuario con caché para mejorar rendimiento
 * @param supabase Cliente de Supabase
 * @param userID ID del usuario
 * @param forceRefresh Si es true, ignora la caché y obtiene datos frescos
 * @returns Array de niveles
 */
export async function getLevels(supabase: SupabaseClient, userID: string, forceRefresh = false) {
	// Si no hay forzado de actualización y existe caché válida, usarla
	if (!forceRefresh && levelsCache.has(userID)) {
		const cache = levelsCache.get(userID)!;
		const now = Date.now();

		// Si la caché no ha expirado, retornar datos en caché
		if (now - cache.timestamp < CACHE_TTL) {
			return cache.data;
		}
	}

	// Obtener datos frescos
	const { data: levels, error } = await supabase
		.from('levels')
		.select('*')
		.contains('users', [userID]);

	const result = error ? [] : levels;

	// Actualizar caché
	if (!error && levels) {
		levelsCache.set(userID, {
			data: levels,
			timestamp: Date.now()
		});
	}

	return result;
}
