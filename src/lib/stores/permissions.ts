// src/lib/stores/permissions.ts
// Sistema de permisos simple y profesional
import { writable, derived, type Readable } from 'svelte/store';

// Simple permission structure
type Permission = {
	code: string;
	user_code: string;
	entity: string;
	action: string;
};

// Permission key format: 'entity:action' (e.g., 'users:read', 'dashboard:general')
type PermissionKey = string;

const createPermissionsStore = () => {
	const permissions = writable<Permission[]>([]);
	const isLoading = writable<boolean>(false);

	// Fetch user permissions
	const fetchPermissions = async (userCode: string) => {
		isLoading.set(true);
		try {
			const response = await fetch(`/api/users/${userCode}/permissions`);
			if (!response.ok) throw new Error(`Failed to fetch permissions: ${response.statusText}`);

			const { permissions: data } = await response.json();
			permissions.set(data || []);
		} catch (error) {
			console.error('Error fetching permissions:', error);
			permissions.set([]);
		} finally {
			isLoading.set(false);
		}
	};

	// Clear permissions
	const clearPermissions = () => {
		permissions.set([]);
	};

	// Check if user has specific permission (simple string format: 'entity:action')
	const has = (permissionKey: PermissionKey): Readable<boolean> => {
		return derived(permissions, ($permissions: Permission[]) => {
			if (!$permissions.length) return false;
			const [entity, action] = permissionKey.split(':');
			return $permissions.some((p: Permission) => p.entity === entity && p.action === action);
		});
	};

	// Get all permission keys for current user
	const getPermissionKeys = (): Readable<PermissionKey[]> => {
		return derived(permissions, ($permissions: Permission[]) => {
			return $permissions.map((p: Permission) => `${p.entity}:${p.action}`);
		});
	};

	return {
		permissions: { subscribe: permissions.subscribe },
		isLoading: { subscribe: isLoading.subscribe },
		fetchPermissions,
		clearPermissions,
		has,
		getPermissionKeys
	};
};

export const permissionsStore = createPermissionsStore();
