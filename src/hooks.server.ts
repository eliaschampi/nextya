import { createServerClient } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { permissionsStore } from '$lib/stores/permissions';

// Configuración del cliente de Supabase
const supabaseHandle: Handle = async ({ event, resolve }) => {
	// Crear el cliente de Supabase para SSR con opciones de cookie para expiración de 24 horas
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) =>
				cookies.forEach(({ name, value, options }) =>
					event.cookies.set(name, value, {
						...options,
						path: '/',
						// Establecer tiempo de vida de la cookie a 24 horas (en segundos)
						maxAge: 60 * 60 * 24
					})
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
	const { session } = await event.locals.getSession();
	event.locals.session = session;

	// Obtener información del usuario si hay sesión
	if (session) {
		const { user } = await event.locals.getUser();
		event.locals.user = user;

		// Verificar si la sesión ha expirado
		const now = Math.floor(Date.now() / 1000);
		if (session.expires_at && session.expires_at < now) {
			// Limpiar sesión y permisos
			await event.locals.supabase.auth.signOut();
			permissionsStore.clearPermissions();
			throw redirect(303, '/auth');
		}

		// Redirigir si hay sesión y la ruta es `/auth`
		if (event.url.pathname === '/auth') {
			throw redirect(303, '/');
		}
	} else {
		// No hay sesión activa
		event.locals.user = null;
		permissionsStore.clearPermissions();

		// Redirigir si no hay sesión y la ruta no es `/auth`
		if (event.url.pathname !== '/auth') {
			throw redirect(303, '/auth');
		}
	}

	return resolve(event);
};

export const handle: Handle = sequence(supabaseHandle, authGuard);
