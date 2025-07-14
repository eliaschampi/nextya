import type { LayoutServerLoad } from './$types';
import { getUserPermissions } from '$lib/auth/permissions';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Obtener permisos del usuario para el cliente
	const userPermissions = locals.user?.code
		? await getUserPermissions(locals.db, locals.user.code)
		: [];

	return {
		user: locals.user,
		session: locals.session,
		userPermissions // Array de strings como ['users:read', 'dashboard:general']
	};
};
