import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Permissions are already loaded in hooks.server.ts - no need to fetch again!
	// This is the key to our efficient system: fetch ONCE, use everywhere
	return {
		user: locals.user,
		session: locals.session,
		userPermissions: locals.userPermissions || [] // Already loaded in hooks
	};
};
