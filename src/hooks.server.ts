import { createServerClient } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { permissionsStore } from '$lib/stores/permissions';

const supabaseHandle: Handle = async ({ event, resolve }) => {
	// Crear cliente de Supabase
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) =>
				cookies.forEach(({ name, value, options }) =>
					event.cookies.set(name, value, { ...options, path: '/' })
				)
		}
	});

	// Función para obtener la sesión segura
	event.locals.safeGetSession = async () => {
		if (event.locals.session) {
			return { session: event.locals.session, user: event.locals.user };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) return { session: null, user: null };

		// Almacenar la sesión y el usuario en locals
		event.locals.session = { user }; // Solo almacenamos el usuario
		event.locals.user = user;

		return { session: event.locals.session, user };
	};

	// Almacenar cookies en locals
	event.locals.cookies = event.cookies.getAll();

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

// Middleware para proteger rutas
const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	if (!session && event.url.pathname !== '/auth') {
		permissionsStore.clearPermissions();
		throw redirect(303, '/auth');
	}
	if (session && event.url.pathname === '/auth') {
		throw redirect(303, '/');
	}

	return resolve(event);
};

export const handle: Handle = sequence(supabaseHandle, authGuard);
