import { writable } from 'svelte/store';
import { supabase } from '../supabaseClient';

export const permissionsStore = (() => {
	const { subscribe, set } = writable<{
		can_create: boolean;
		can_update: boolean;
		can_delete: boolean;
	} | null>(null);

	let cachedUserCode: string | null = null;

	// Función para cargar permisos desde Supabase
	const fetchPermissions = async (userCode: string) => {
		if (cachedUserCode === userCode) return; // Evitar llamadas duplicadas si ya están cargados

		const { data, error } = await supabase
			.from('permissions')
			.select('*')
			.eq('user_code', userCode)
			.single();

		if (error) {
			console.error('Error fetching permissions:', error);
			return;
		}

		cachedUserCode = userCode; // Almacenar el código del usuario para futuras referencias
		set(data); // Actualizar el store con los permisos
	};

	// Función para limpiar los permisos (útil al cerrar sesión)
	const clearPermissions = () => {
		cachedUserCode = null;
		set(null);
	};

	return {
		subscribe,
		fetchPermissions,
		clearPermissions
	};
})();
