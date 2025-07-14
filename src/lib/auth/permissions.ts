// src/lib/auth/permissions.ts
// Sistema de validación de permisos simple y profesional
import type { Database } from '$lib/database';

/**
 * Valida si un usuario tiene un permiso específico
 * @param db - Instancia de la base de datos
 * @param userCode - Código del usuario
 * @param permissionKey - Permiso en formato 'entity:action' (ej: 'users:read')
 * @returns Promise<boolean>
 */
export async function hasPermission(
	db: Database,
	userCode: string,
	permissionKey: string
): Promise<boolean> {
	try {
		// Super admin tiene todos los permisos
		const user = await db
			.selectFrom('users')
			.select(['is_super_admin'])
			.where('code', '=', userCode)
			.executeTakeFirst();

		if (user?.is_super_admin) return true;

		// Parsear el permiso
		const [entity, action] = permissionKey.split(':');
		if (!entity || !action) return false;

		// Verificar permiso específico
		const permission = await db
			.selectFrom('permissions')
			.select(['code'])
			.where('user_code', '=', userCode)
			.where('entity', '=', entity as never)
			.where('action', '=', action)
			.executeTakeFirst();

		return !!permission;
	} catch (error) {
		console.error('Error checking permission:', error);
		return false;
	}
}

/**
 * Middleware para proteger rutas API
 * Uso: await requirePermission(locals.db, locals.user?.code, 'users:read')
 */
export async function requirePermission(
	db: Database,
	userCode: string | undefined,
	permissionKey: string
): Promise<{ success: boolean; error?: string }> {
	if (!userCode) {
		return { success: false, error: 'Usuario no autenticado' };
	}

	const hasAccess = await hasPermission(db, userCode, permissionKey);

	if (!hasAccess) {
		return {
			success: false,
			error: `Permiso requerido: ${permissionKey}`
		};
	}

	return { success: true };
}

/**
 * Obtener todos los permisos de un usuario
 */
export async function getUserPermissions(db: Database, userCode: string): Promise<string[]> {
	try {
		const permissions = await db
			.selectFrom('permissions')
			.select(['entity', 'action'])
			.where('user_code', '=', userCode)
			.execute();

		return permissions.map((p) => `${p.entity}:${p.action}`);
	} catch (error) {
		console.error('Error getting user permissions:', error);
		return [];
	}
}
