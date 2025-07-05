import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getSession } from '$lib/auth/session';
import { hasPermission } from '$lib/auth';
import { dbInstance } from '$lib/config/server';

// Create database instance with environment variables (server-only)

// Database handle - attach database instance to locals
const databaseHandle: Handle = async ({ event, resolve }) => {
	event.locals.db = dbInstance;
	return resolve(event);
};

// Authentication handle - get session and user from cookies
const authHandle: Handle = async ({ event, resolve }) => {
	const session = await getSession(dbInstance, event.cookies);
	event.locals.session = session;
	event.locals.user = session?.user ?? null;

	// Add permission checker to locals
	if (session?.user) {
		event.locals.can = {
			check: (entity: string, action: string) =>
				hasPermission(dbInstance, session.user.code, entity, action),
			read: (entity: string) => hasPermission(dbInstance, session.user.code, entity, 'read'),
			create: (entity: string) => hasPermission(dbInstance, session.user.code, entity, 'create'),
			update: (entity: string) => hasPermission(dbInstance, session.user.code, entity, 'update'),
			delete: (entity: string) => hasPermission(dbInstance, session.user.code, entity, 'delete')
		};
	} else {
		event.locals.can = {
			check: () => Promise.resolve(false),
			read: () => Promise.resolve(false),
			create: () => Promise.resolve(false),
			update: () => Promise.resolve(false),
			delete: () => Promise.resolve(false)
		};
	}

	return resolve(event);
};

// Auth guard - redirect based on authentication state
const authGuard: Handle = async ({ event, resolve }) => {
	const isAuthPage = event.url.pathname.startsWith('/auth');
	const isApiRoute = event.url.pathname.startsWith('/api');

	// Skip auth guard for API routes (they handle auth internally)
	if (isApiRoute) {
		return resolve(event);
	}

	// Redirect to auth if not authenticated and not on auth page
	if (!event.locals.user && !isAuthPage) {
		throw redirect(303, '/auth');
	}

	// Redirect to dashboard if authenticated and on auth page
	if (event.locals.user && isAuthPage) {
		throw redirect(303, '/');
	}

	return resolve(event);
};

export const handle: Handle = sequence(databaseHandle, authHandle, authGuard);
