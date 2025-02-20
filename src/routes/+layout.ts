import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { permissionsStore } from '$lib/stores/permissions';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	depends('supabase:auth');

	let supabase = null;
	let session = null;

	if (isBrowser()) {
		supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: {
				fetch
			}
		});
		session = (await supabase.auth.getSession()).data.session;
	} else {
		supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			global: {
				fetch
			},
			cookies: {
				getAll: () => data.cookies
			}
		});
		session = data.session;
	}

	if (session) {
		// Cargar permisos del usuario autenticado
		permissionsStore.fetchPermissions(session.user.id);
	}

	return { session, supabase };
};
