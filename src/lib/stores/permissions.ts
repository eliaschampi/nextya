// src/lib/stores/permission.ts
import { writable, derived, type Readable, get } from 'svelte/store';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Permission } from '../../app';
import type { Database } from '../../database.types';

type PermissionCheck = {
	entity: string;
	action: 'create' | 'update' | 'delete';
};

const createPermissionsStore = () => {
	const permissions = writable<Permission[]>([]);
	const currentUserCode = writable<string | null>(null);
	let isLoading = false;

	const fetchPermissions = async (supabase: SupabaseClient<Database>, userCode: string) => {
		if (isLoading) return;
		const currentCode = get(currentUserCode);
		if (currentCode === userCode) return;
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('permissions')
				.select('*')
				.eq('user_code', userCode);

			if (error) throw error;

			currentUserCode.set(userCode);
			permissions.set(data || []);
		} catch {
			permissions.set([]);
			currentUserCode.set(null);
		} finally {
			isLoading = false;
		}
	};

	const clearPermissions = () => {
		permissions.set([]);
		currentUserCode.set(null);
	};

	const has = (check: PermissionCheck): Readable<boolean> => {
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

	return {
		permissions: { subscribe: permissions.subscribe },
		fetchPermissions,
		clearPermissions,
		has
	};
};

export const permissionsStore = createPermissionsStore();

