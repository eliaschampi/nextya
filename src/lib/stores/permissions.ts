// src/lib/stores/permission.ts
import { writable, derived, type Readable } from 'svelte/store';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Permission } from '../../app';
import type { Database } from '../../database.types';

// Define el tipo Permission según tu esquema de base de datos

// Tipo para las opciones de verificación de permisos
type PermissionCheck = {
	entity: string;
	action: 'create' | 'update' | 'delete';
};

const createPermissionsStore = () => {
	// Store para los permisos del usuario actual
	const permissions = writable<Permission[]>([]);
	// Store para el código de usuario actual (evita recargas innecesarias)
	const currentUserCode = writable<string | null>(null);
	// Flag para evitar múltiples cargas simultáneas
	let isLoading = false;

	// Carga los permisos desde Supabase
	const fetchPermissions = async (supabase: SupabaseClient<Database>, userCode: string) => {
		if (isLoading) return;

		const currentCode = get(currentUserCode);
		if (currentCode === userCode) return; // Ya tenemos los permisos de este usuario

		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('permissions')
				.select('*')
				.eq('user_code', userCode);

			if (error) throw error;

			currentUserCode.set(userCode);
			permissions.set(data || []);
		} catch (error) {
			console.error('Error loading permissions:', error);
			permissions.set([]);
			currentUserCode.set(null);
		} finally {
			isLoading = false;
		}
	};

	// Limpia los permisos (útil para logout)
	const clearPermissions = () => {
		permissions.set([]);
		currentUserCode.set(null);
	};

	// Verifica si el usuario tiene un permiso específico
	const hasPermission = (check: PermissionCheck): Readable<boolean> => {
		return derived(permissions, ($permissions) => {
			if (!$permissions.length) return false;

			const permission = $permissions.find((p) => p.entity === check.entity);
			if (!permission) return false;

			switch (check.action) {
				case 'create':
					return permission.can_create;
				case 'update':
					return permission.can_update;
				case 'delete':
					return permission.can_delete;
				default:
					return false;
			}
		});
	};

	// Verifica si el usuario tiene al menos un permiso para una entidad
	const hasAnyPermission = (entity: string): Readable<boolean> => {
		return derived(permissions, ($permissions) => {
			const permission = $permissions.find((p) => p.entity === entity);
			return permission
				? permission.can_create || permission.can_update || permission.can_delete
				: false;
		});
	};

	return {
		permissions: { subscribe: permissions.subscribe },
		fetchPermissions,
		clearPermissions,
		hasPermission,
		hasAnyPermission
	};
};

// Exportamos el store singleton
export const permissionsStore = createPermissionsStore();

// Helper para obtener el valor actual de un store
function get<T>(store: Readable<T>): T {
	let value: T;
	store.subscribe((v) => (value = v))();
	return value!;
}
