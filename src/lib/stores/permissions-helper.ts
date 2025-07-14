// src/lib/stores/permissions-helper.ts
// Sistema de permisos eficiente y moderno
import { writable, derived, type Readable } from 'svelte/store';
import { page } from '$app/stores';

// Store simple con los permisos del usuario actual
const userPermissions = writable<string[]>([]);

// Inicializar permisos desde page data
page.subscribe(($page) => {
	if ($page.data?.userPermissions) {
		userPermissions.set($page.data.userPermissions);
	}
});

// Helper function para verificar un permiso específico
export function can(permissionKey: string): Readable<boolean> {
	return derived(userPermissions, ($permissions) => {
		return $permissions.includes(permissionKey);
	});
}

// Helper para múltiples permisos (ANY)
export function canAny(...permissionKeys: string[]): Readable<boolean> {
	return derived(userPermissions, ($permissions) => {
		return permissionKeys.some((key) => $permissions.includes(key));
	});
}

// Helper para múltiples permisos (ALL)
export function canAll(...permissionKeys: string[]): Readable<boolean> {
	return derived(userPermissions, ($permissions) => {
		return permissionKeys.every((key) => $permissions.includes(key));
	});
}

// Export del store de permisos para uso directo
export { userPermissions };
