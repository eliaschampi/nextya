// routes/libs/stores/permissions.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from 'lucide-svelte';
import { writable } from 'svelte/store';

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
	const fetchPermissions = async (SupabaseClient: SupabaseClient<Database>, userCode: string) => {
		if (cachedUserCode === userCode) return; // Evita llamadas duplicadas

		const { data, error } = await SupabaseClient.from('permissions')
			.select('*')
			.eq('user_code', userCode)
			.single();

		if (error) {
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
