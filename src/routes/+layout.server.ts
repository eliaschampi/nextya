import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { session } = await locals.getSession();

	// Solo obtener el usuario autenticado si hay sesión
	const { user } = session ? await locals.getUser() : { user: null };

	return {
		session,
		user,
		cookies: locals.cookies
	};
};
