import { createServerClient } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Configuración del cliente de Supabase
const supabaseHandle: Handle = async ({ event, resolve }) => {
	// Crear el cliente de Supabase para SSR
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) =>
				cookies.forEach(({ name, value, options }) =>
					event.cookies.set(name, value, { ...options, path: '/' })
				)
		}
	});

	// Método para obtener la sesión (rápido, pero inseguro para datos críticos)
	event.locals.getSession = async () => {
		const {
			data: { session },
			error
		} = await event.locals.supabase.auth.getSession();
		return error ? { session: null } : { session };
	};

	// Método para obtener el usuario autenticado (más lento, pero seguro)
	event.locals.getUser = async () => {
		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		return error ? { user: null } : { user };
	};

	/**
	 * Unlike `supabase.auth.getSession()`, which returns the session _without_
	 * validating the JWT, this function also calls `getUser()` to validate the
	 * JWT before returning the session.
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) {
			// JWT validation has failed
			return { session: null, user: null };
		}

		return { session, user };
	};

	// Almacenar las cookies para usarlas en otros lugares
	event.locals.cookies = event.cookies.getAll();

	// Resolver la petición, filtrando encabezados específicos
	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

// Guardia de autenticación
const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	if (!event.locals.session && event.url.pathname !== '/auth') {
		throw redirect(303, '/auth');
	}

	if (event.locals.session && event.url.pathname === '/auth') {
		throw redirect(303, '/');
	}

	return resolve(event);
};

export const handle: Handle = sequence(supabaseHandle, authGuard);
