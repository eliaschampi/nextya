// routes/users/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { hash } from 'bcryptjs';

export const load: PageServerLoad = async ({ depends, locals }) => {
	depends('users:load');

	if (!(await locals.can('users:read'))) {
		return { users: [], title: 'Usuarios' };
	}

	try {
		const users = await locals.db
			.selectFrom('users')
			.select([
				'code',
				'email',
				'name',
				'last_name',
				'photo_url',
				'is_super_admin',
				'created_at',
				'last_login'
			])
			.execute();

		return { users, title: 'Usuarios' };
	} catch {
		return { users: [], title: 'Usuarios' };
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		// Verificar permiso para crear usuarios
		if (!(await locals.can('users:create'))) {
			return fail(403, { error: 'Sin permisos para crear usuarios' });
		}

		const formData = await request.formData();
		const email = formData.get('email') as string;
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const password = formData.get('password') as string;
		const photo_url = (formData.get('photo_url') as string) || 'avatar.svg';

		try {
			// Check if user already exists
			const existingUser = await locals.db
				.selectFrom('users')
				.select('code')
				.where('email', '=', email.toLowerCase())
				.executeTakeFirst();

			if (existingUser) {
				return fail(400, { error: 'El usuario ya existe' });
			}

			// Hash password
			const password_hash = await hash(password, 12);

			// Create user
			await locals.db
				.insertInto('users')
				.values({
					email: email.toLowerCase(),
					password_hash,
					name,
					last_name,
					photo_url,
					is_email_verified: true, // Auto-confirm for admin created users
					is_super_admin: false
				})
				.execute();

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error creando usuario';
			return fail(400, { error: message });
		}
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const userId = formData.get('user_id') as string;
		const email = formData.get('email') as string;
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const photo_url = (formData.get('photo_url') as string) || 'avatar.svg';

		try {
			await locals.db
				.updateTable('users')
				.set({
					email: email.toLowerCase(),
					name,
					last_name,
					photo_url
				})
				.where('code', '=', userId)
				.execute();

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error actualizando usuario';
			return fail(400, { error: message });
		}
	},

	updatePassword: async ({ request, locals }) => {
		const formData = await request.formData();
		const userId = formData.get('user_id') as string;
		const password = formData.get('password') as string;

		try {
			// Hash new password
			const password_hash = await hash(password, 12);

			await locals.db
				.updateTable('users')
				.set({ password_hash })
				.where('code', '=', userId)
				.execute();

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error actualizando contraseña';
			return fail(400, { error: message });
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const userId = formData.get('user_id') as string;

		// Check if trying to delete self
		if (locals.user?.code === userId) {
			return fail(400, { error: 'No puedes eliminar a ti mismo' });
		}

		try {
			await locals.db.deleteFrom('users').where('code', '=', userId).execute();

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error eliminando usuario';
			return fail(400, { error: message });
		}
	}
};
