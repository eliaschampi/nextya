// src/routes/auth/+page.server.ts
import { AuthApiError } from '@supabase/supabase-js';
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const actions: Actions = {
	login: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		const { error: err } = await locals.supabase.auth.signInWithPassword({ email, password });

		if (err) {
			console.log(email, password);
			if (err instanceof AuthApiError && err.status === 400) {
				return fail(400, {
					error: 'Credenciales incorrectas.'
				});
			}

			return fail(500, {
				error: 'Ocurrio algo inesperado.'
			});
		}

		throw redirect(303, '/');
	}
};
