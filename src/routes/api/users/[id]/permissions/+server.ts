import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

// Type definitions for better code safety
type Permission = {
	entity: string;
	user_action: string;
};

// GET /api/users/[id]/permissions
export const GET: RequestHandler = async ({ params, locals }) => {
	const userId = params.id;

	if (!userId) {
		throw error(400, 'Id de usuario requerido');
	}

	try {
		const permissions = await locals.db
			.selectFrom('permissions')
			.selectAll()
			.where('user_code', '=', userId)
			.execute();

		return json({ permissions: permissions || [] });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Error al obtener permisos de usuario';
		throw error(500, message);
	}
};

// POST /api/users/[id]/permissions
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const userId = params.id;

	if (!userId) {
		throw error(400, 'Id de usuario requerido');
	}

	try {
		const body = await request.json();
		const { permissions } = body as { permissions: Permission[] };

		if (!permissions || !Array.isArray(permissions)) {
			throw error(400, 'Formato de permisos inválido');
		}

		// First delete all existing permissions (except users entity)
		await locals.db
			.deleteFrom('permissions')
			.where('user_code', '=', userId)
			.where('entity', '!=', 'users')
			.execute();

		// Map permissions to the new structure
		const permissionsToInsert = permissions.map((p) => ({
			user_code: userId,
			entity: p.entity,
			action: p.user_action
		}));

		// If we have permissions to insert, do it
		if (permissionsToInsert.length > 0) {
			await locals.db.insertInto('permissions').values(permissionsToInsert).execute();
		}

		return json({
			success: true,
			count: permissionsToInsert.length
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Error al guardar permisos";
		throw error(500, message);
	}
};
