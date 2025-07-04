import { fail, redirect } from '@sveltejs/kit';
import { login, signup } from '$lib/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// If user is already authenticated, redirect to dashboard
	if (locals.user) {
		throw redirect(303, '/dashboard');
	}

	return {};
};

export const actions: Actions = {
	login: async ({ request, cookies, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		if (!email || !password) {
			return fail(400, {
				error: 'Email y contraseña son requeridos',
				email
			});
		}

		const result = await login(locals.db, { email, password }, cookies);

		if (!result.success) {
			return fail(400, {
				error: result.error || 'Credenciales incorrectas',
				email
			});
		}

		throw redirect(303, '/dashboard');
	},

	signup: async ({ request, cookies, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const name = formData.get('name') as string;
		const lastName = formData.get('lastName') as string;

		if (!email || !password) {
			return fail(400, {
				error: 'Email y contraseña son requeridos',
				email,
				name,
				lastName
			});
		}

		if (password.length < 6) {
			return fail(400, {
				error: 'La contraseña debe tener al menos 6 caracteres',
				email,
				name,
				lastName
			});
		}

		const result = await signup(locals.db, { email, password, name, lastName }, cookies);

		if (!result.success) {
			return fail(400, {
				error: result.error || 'Error al crear la cuenta',
				email,
				name,
				lastName
			});
		}

		throw redirect(303, '/dashboard');
	}
};
