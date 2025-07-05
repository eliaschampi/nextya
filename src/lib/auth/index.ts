import type { Database } from '$lib/database';
import { hash, compare } from 'bcryptjs';
import { createSession, destroySession } from './session';
import type { Cookies } from '@sveltejs/kit';

export interface LoginCredentials {
	email: string;
	password: string;
}

export interface SignupData {
	email: string;
	password: string;
	name?: string;
	lastName?: string;
}

/**
 * Authenticate user with email and password
 */
export async function login(db: Database, credentials: LoginCredentials, cookies: Cookies) {
	try {
		const { email, password } = credentials;

		// Find user by email
		const user = await db
			.selectFrom('users')
			.select(['code', 'email', 'password_hash', 'name'])
			.where('email', '=', email.toLowerCase())
			.executeTakeFirst();

		if (!user) {
			throw new Error('Usuario no encontrado');
		}

		// Verify password
		const isValidPassword = await compare(password, user.password_hash);
		if (!isValidPassword) {
			throw new Error('Contraseña incorrecta');
		}

		// Create session
		const session = await createSession(db, user.code, cookies);
		if (!session) {
			throw new Error('Falló al crear sesión');
		}

		return {
			success: true,
			user: session.user
		};
	} catch (error) {
		console.error('Login error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Login failed'
		};
	}
}

/**
 * Register a new user
 */
export async function signup(db: Database, data: SignupData, cookies: Cookies) {
	try {
		const { email, password, name, lastName } = data;

		// Check if user already exists
		const existingUser = await db
			.selectFrom('users')
			.select('code')
			.where('email', '=', email.toLowerCase())
			.executeTakeFirst();

		if (existingUser) {
			throw new Error('Usuario ya existe');
		}

		// Hash password
		const passwordHash = await hash(password, 12);

		// Create user
		const newUser = await db
			.insertInto('users')
			.values({
				email: email.toLowerCase(),
				password_hash: passwordHash,
				name: name || null,
				last_name: lastName || null,
				is_email_verified: false,
				is_super_admin: false
			})
			.returning(['code', 'email', 'name'])
			.executeTakeFirstOrThrow();

		// Create session
		const session = await createSession(db, newUser.code, cookies);
		if (!session) {
			throw new Error('Failed to create session');
		}

		return {
			success: true,
			user: session.user
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Inicio de sesión fallido'
		};
	}
}

/**
 * Logout user
 */
export async function logout(cookies: Cookies) {
	try {
		destroySession(cookies);
		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Ocurrió un error'
		};
	}
}

/**
 * Check if user has permission for an action
 */
export async function hasPermission(
	db: Database,
	userCode: string,
	entity: string,
	action: string
): Promise<boolean> {
	try {
		const permission = await db
			.selectFrom('permissions')
			.select('code')
			.where('user_code', '=', userCode)
			.where('entity', '=', entity)
			.where('action', '=', action)
			.executeTakeFirst();

		return !!permission;
	} catch {
		return false;
	}
}
