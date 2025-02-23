// routes/libs/stores/permissions.ts
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

export interface Permissions {
	can_create: boolean;
	can_update: boolean;
	can_delete: boolean;
	// Puedes extender con más campos según la entidad
}

const createPermissionsStore = () => {
	const { subscribe, set } = writable<Permissions | null>(null);
	let cachedUserCode: string | null = null;

	// Función para cargar permisos
	const fetchPermissions = async (userCode: string) => {
		if (cachedUserCode === userCode) return; // Evita llamadas duplicadas

		const { data, error } = await supabase
			.from('permissions')
			.select('*')
			.eq('user_code', userCode)
			.single();

		if (error) {
			console.error('Error al cargar permisos:', error);
			set(null);
			return;
		}
		cachedUserCode = userCode;
		set(data);
	};

	const clearPermissions = () => {
		cachedUserCode = null;
		set(null);
	};

	return { subscribe, fetchPermissions, clearPermissions };
};

export const permissionsStore = createPermissionsStore();
