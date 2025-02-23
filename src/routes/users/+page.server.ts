// routes/users/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';

export const load: PageServerLoad = async ({ locals }) => {
	// Consultar la vista que une auth.users y profiles
	const { data: users, error } = await locals.supabase.from('user_profiles').select('*');

	if (error) {
		console.error('Error al cargar usuarios:', error);
		return { users: [] };
	}

	return { users };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;

		// Verifica permisos en el backend (por ejemplo, leyendo locals o validando token)
		// Aquí se asume que la validación RLS ya impide inserciones no autorizadas

		// Crear el usuario en Auth (flujo de invitación o creación directa)
		const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
			email,
			password: 'default-password' // En un entorno real: generar contraseña segura o enviar invitación
		});
		if (authError) return { error: authError.message };

		const userId = authUser.user.id;

		// Insertar el perfil asociado
		const { error: profileError } = await locals.supabase
			.from('profiles')
			.insert({ code: userId, name, last_name });
		if (profileError) return { error: profileError.message };

		return { success: true };
	},
	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const email = formData.get('email') as string | null;

		// Actualizar el perfil (se respeta RLS en base de datos)
		const { error: profileError } = await locals.supabase
			.from('profiles')
			.update({ name, last_name })
			.eq('code', userId);
		if (profileError) return { error: profileError.message };

		// Actualizar email en Auth (opcional)
		if (email) {
			const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email });
			if (authError) return { error: authError.message };
		}

		return { success: true };
	},
	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const userId = formData.get('userId') as string;

		// Borrar el perfil; con ON DELETE CASCADE se debería borrar también el usuario en auth
		const { error: profileError } = await locals.supabase
			.from('profiles')
			.delete()
			.eq('code', userId);
		if (profileError) return { error: profileError.message };

		// Opcional: borrar el usuario en auth explícitamente
		const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
		if (authError) return { error: authError.message };

		return { success: true };
	}
};
