/**
 * UNIFIED PERMISSION SYSTEM
 * Simple, efficient, modern approach - fetch ONCE, store in Svelte store
 *
 * ARCHITECTURE:
 * - Permissions loaded ONCE per session from +layout.server.ts
 * - Stored in reactive Svelte store
 * - No multiple API calls, no complex database queries
 * - Clean, minimalist, solid approach
 */

import { writable, derived, type Readable } from 'svelte/store';
import { page } from '$app/stores';

// ============================================================================
// TYPES - Clean and minimal
// ============================================================================

export type PermissionKey = string; // Format: 'entity:action' (e.g., 'users:read')

// ============================================================================
// STORE - Single source of truth
// ============================================================================

// Internal store for permission keys
const userPermissions = writable<PermissionKey[]>([]);

// Initialize permissions from page data (loaded once per session)
page.subscribe(($page) => {
	if ($page.data?.userPermissions) {
		userPermissions.set($page.data.userPermissions);
	}
});

// ============================================================================
// PUBLIC API - Simple and efficient
// ============================================================================

/**
 * Check if user has a specific permission
 * @param permissionKey - Permission in format 'entity:action'
 * @returns Readable<boolean> - Reactive permission state
 */
export function can(permissionKey: PermissionKey): Readable<boolean> {
	return derived(userPermissions, ($permissions) => {
		return $permissions.includes(permissionKey);
	});
}

/**
 * Check if user has ANY of the specified permissions
 * @param permissionKeys - Array of permission keys
 * @returns Readable<boolean> - True if user has at least one permission
 */
export function canAny(...permissionKeys: PermissionKey[]): Readable<boolean> {
	return derived(userPermissions, ($permissions) => {
		return permissionKeys.some((key) => $permissions.includes(key));
	});
}

/**
 * Check if user has ALL of the specified permissions
 * @param permissionKeys - Array of permission keys
 * @returns Readable<boolean> - True if user has all permissions
 */
export function canAll(...permissionKeys: PermissionKey[]): Readable<boolean> {
	return derived(userPermissions, ($permissions) => {
		return permissionKeys.every((key) => $permissions.includes(key));
	});
}

/**
 * Get all user permissions (reactive)
 * @returns Readable<PermissionKey[]> - Array of permission keys
 */
export function getPermissions(): Readable<PermissionKey[]> {
	return { subscribe: userPermissions.subscribe };
}

/**
 * Update permissions (for admin operations like PermissionsModal)
 * @param permissions - New permission keys array
 */
export function updatePermissions(permissions: PermissionKey[]): void {
	userPermissions.set(permissions);
}

/**
 * Clear all permissions (for logout)
 */
export function clearPermissions(): void {
	userPermissions.set([]);
}
