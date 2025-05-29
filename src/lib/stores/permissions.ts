// src/lib/stores/permission.ts
import { writable, derived, type Readable, get } from 'svelte/store';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database.types';
import { browser } from '$app/environment';

// Define the permission structure
type Permission = {
	code: string;
	user_code: string;
	entity: string;
	user_action: string;
};

type PermissionCheck = {
	entity: string;
	action: 'read' | 'create' | 'update' | 'delete';
};

// Cache key for localStorage
const PERMISSIONS_CACHE_KEY = 'nextya_permissions_cache';
const PERMISSIONS_CACHE_EXPIRY_KEY = 'nextya_permissions_cache_expiry';
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes in milliseconds

const createPermissionsStore = () => {
	const permissions = writable<Permission[]>([]);
	const currentUserCode = writable<string | null>(null);
	let isLoading = false;
	let lastFetchTime = 0;

	// Load cached permissions on initialization if in browser
	if (browser) {
		try {
			const cachedPermissions = localStorage.getItem(PERMISSIONS_CACHE_KEY);
			const cacheExpiry = localStorage.getItem(PERMISSIONS_CACHE_EXPIRY_KEY);

			if (cachedPermissions && cacheExpiry) {
				const expiryTime = parseInt(cacheExpiry, 10);
				const now = Date.now();

				// Only use cache if it's not expired
				if (now < expiryTime) {
					const parsedPermissions = JSON.parse(cachedPermissions);
					const userCode = parsedPermissions.userCode;

					if (userCode && parsedPermissions.data) {
						permissions.set(parsedPermissions.data);
						currentUserCode.set(userCode);
						lastFetchTime = now;
					}
				} else {
					// Clear expired cache
					localStorage.removeItem(PERMISSIONS_CACHE_KEY);
					localStorage.removeItem(PERMISSIONS_CACHE_EXPIRY_KEY);
				}
			}
		} catch (error) {
			console.error('Error loading cached permissions:', error);
			// Clear potentially corrupted cache
			localStorage.removeItem(PERMISSIONS_CACHE_KEY);
			localStorage.removeItem(PERMISSIONS_CACHE_EXPIRY_KEY);
		}
	}

	const fetchPermissions = async (supabase: SupabaseClient<Database>, userCode: string) => {
		// Skip if already loading
		if (isLoading) return;

		// Skip if same user and recently fetched (within last 5 minutes)
		const currentCode = get(currentUserCode);
		const now = Date.now();
		if (currentCode === userCode && now - lastFetchTime < 300000) return;

		isLoading = true;

		try {
			const { data, error } = await supabase
				.from('permissions')
				.select('*')
				.eq('user_code', userCode);

			if (error) throw error;

			// Update stores
			currentUserCode.set(userCode);
			permissions.set(data || []);
			lastFetchTime = now;

			// Cache permissions in browser
			if (browser) {
				try {
					const cacheData = {
						userCode,
						data: data || [],
						timestamp: now
					};
					localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(cacheData));
					localStorage.setItem(PERMISSIONS_CACHE_EXPIRY_KEY, (now + CACHE_TTL).toString());
				} catch (error) {
					console.error('Error caching permissions:', error);
				}
			}
		} catch (error) {
			console.error('Error fetching permissions:', error);
			permissions.set([]);
			currentUserCode.set(null);
			// Clear cache on error
			if (browser) {
				localStorage.removeItem(PERMISSIONS_CACHE_KEY);
				localStorage.removeItem(PERMISSIONS_CACHE_EXPIRY_KEY);
			}
		} finally {
			isLoading = false;
		}
	};

	const clearPermissions = () => {
		permissions.set([]);
		currentUserCode.set(null);

		// Clear cache in browser
		if (browser) {
			localStorage.removeItem(PERMISSIONS_CACHE_KEY);
			localStorage.removeItem(PERMISSIONS_CACHE_EXPIRY_KEY);
		}
	};

	const has = (check: PermissionCheck): Readable<boolean> => {
		return derived(permissions, ($permissions) => {
			if (!$permissions.length) return false;
			return $permissions.some((p) => p.entity === check.entity && p.user_action === check.action);
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
