import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { permissionsStore } from '$lib/stores/permissions';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	depends('supabase:auth');

	let supabase = null;

	if (isBrowser()) {
		supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { fetch }
		});
	} else {
		supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: { fetch },
			cookies: { getAll: () => data.cookies }
		});
	}

	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (user) {
		// Cargar permisos del usuario autenticado
		permissionsStore.fetchPermissions(user.id);
	}

	return { session: { user }, supabase, user };
};
