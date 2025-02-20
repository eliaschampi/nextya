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

		const { data } = await supabase
			.from('permissions')
			.select('*')
			.eq('user_code', userCode)
			.single();

		if (data) {
			cachedUserCode = userCode;
			set(data);
		}
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
