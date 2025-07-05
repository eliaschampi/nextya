// src/lib/stores/permissions.ts
import { writable, derived, type Readable } from 'svelte/store';

// Define the permission structure
type Permission = {
	code: string;
	user_code: string;
	entity: string;
	action: string;
};

type PermissionCheck = {
	entity: string;
	action: 'read' | 'create' | 'update' | 'delete';
};

const createPermissionsStore = () => {
	const permissions = writable<Permission[]>([]);
	const isLoading = writable<boolean>(false);

	const fetchPermissions = async (userCode: string) => {
		isLoading.set(true);

		try {
			const response = await fetch(`/api/users/${userCode}/permissions`);
			if (!response.ok) {
				throw new Error(`Failed to fetch permissions: ${response.statusText}`);
			}

			const { permissions: data } = await response.json();
			permissions.set(data || []);
		} catch (error) {
			console.error('Error fetching permissions:', error);
			permissions.set([]);
		} finally {
			isLoading.set(false);
		}
	};

	const clearPermissions = () => {
		permissions.set([]);
	};

	const has = (check: PermissionCheck): Readable<boolean> => {
		return derived(permissions, ($permissions) => {
			if (!$permissions.length) return false;
			return $permissions.some((p) => p.entity === check.entity && p.action === check.action);
		});
	};

	return {
		permissions: { subscribe: permissions.subscribe },
		isLoading: { subscribe: isLoading.subscribe },
		fetchPermissions,
		clearPermissions,
		has
	};
};

export const permissionsStore = createPermissionsStore();
