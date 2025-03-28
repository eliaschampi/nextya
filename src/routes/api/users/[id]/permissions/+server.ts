import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { error } from '@sveltejs/kit';

// Type definitions for better code safety
type Permission = {
	entity: string;
	can_create: boolean;
	can_update: boolean;
	can_delete: boolean;
};

// GET /api/users/[id]/permissions
export const GET: RequestHandler = async ({ params }) => {
	const userId = params.id;

	if (!userId) {
		throw error(400, 'Id de usuario requerido');
	}

	try {
		const { data, error: dbError } = await supabaseAdmin
			.from('permissions')
			.select('*')
			.eq('user_code', userId);

		if (dbError) throw dbError;

		return json({ permissions: data || [] });
	} catch (err) {
		console.error('Error fetching permissions:', err);
		throw error(500, err instanceof Error ? err.message : 'Error al obtener permisos de usuario');
	}
};

// POST /api/users/[id]/permissions
export const POST: RequestHandler = async ({ params, request }) => {
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

		// First delete all existing permissions
		const { error: deleteError } = await supabaseAdmin
			.from('permissions')
			.delete()
			.eq('user_code', userId);

		if (deleteError) throw deleteError;

		// Only insert permissions that have at least one permission enabled
		const permissionsToInsert = permissions
			.filter((p) => p.can_create || p.can_update || p.can_delete)
			.map((p) => ({
				user_code: userId,
				entity: p.entity,
				can_create: p.can_create,
				can_update: p.can_update,
				can_delete: p.can_delete
			}));

		// If we have permissions to insert, do it
		if (permissionsToInsert.length > 0) {
			const { error: insertError } = await supabaseAdmin
				.from('permissions')
				.insert(permissionsToInsert);

			if (insertError) throw insertError;
		}

		return json({
			success: true,
			count: permissionsToInsert.length
		});
	} catch (err) {
		console.error('Error saving permissions:', err);
		throw error(500, err instanceof Error ? err.message : 'Error al guardar permisos');
	}
};
