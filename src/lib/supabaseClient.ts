import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Crear cliente de Supabase con configuración para expiración de sesión
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
	auth: {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
		// Configuración para expiración de sesión
		storageKey: 'supabase.auth.token',
		storage: {
			getItem: (key) => {
				const item = localStorage.getItem(key);
				if (item) {
					// Verificar si la sesión ha expirado (24 horas)
					try {
						const { expiresAt } = JSON.parse(item);
						const now = Math.floor(Date.now() / 1000);
						if (expiresAt && expiresAt < now) {
							// Si ha expirado, eliminar la sesión
							localStorage.removeItem(key);
							return null;
						}
					} catch (error) {
						console.error('Error al verificar expiración de sesión:', error);
					}
				}
				return item;
			},
			setItem: (key, value) => localStorage.setItem(key, value),
			removeItem: (key) => localStorage.removeItem(key)
		}
	}
});
