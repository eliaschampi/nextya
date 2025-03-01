// src/routes/auth/+page.server.ts
import { AuthApiError } from '@supabase/supabase-js';
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const actions: Actions = {
	login: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });

		if (error) {
			if (error instanceof AuthApiError && error.status === 400) {
				return fail(400, {
					error: 'El correo o la contraseña son incorrectos.'
				});
			}
			return fail(500, {
				error: 'Ocurrió un error inesperado.'
			});
		}
		throw redirect(303, '/');
	}
};
