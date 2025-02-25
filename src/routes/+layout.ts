import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createBrowserClient, isBrowser } from '@supabase/ssr';
import { permissionsStore } from '$lib/stores/permissions';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	depends('supabase:auth');

	let supabase = null;
	let session = null;
	let user = null;

	// Crear cliente de Supabase para el navegador o el servidor
	if (isBrowser()) {
		supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { fetch }
		});

		// Obtener la sesión en el cliente
		const { data: sessionData } = await supabase.auth.getSession();
		session = sessionData.session;

		// Obtener el usuario autenticado si hay sesión
		if (session) {
			const { data: userData } = await supabase.auth.getUser();
			user = userData.user;
		}
	} else {
		supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { fetch }
		});
		session = data.session;
		user = data.user;
	}

	// Cargar permisos si hay sesión y usuario autenticado
	if (session && user) {
		permissionsStore.fetchPermissions(user.id);
	}

	return { session, supabase, user, title: data.title };
};
