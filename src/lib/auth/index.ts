import { db } from '$lib/database';
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
export async function login(credentials: LoginCredentials, cookies: Cookies) {
	try {
		const { email, password } = credentials;

		// Find user by email
		const user = await db
			.selectFrom('users')
			.select(['code', 'email', 'passwordHash', 'name'])
			.where('email', '=', email.toLowerCase())
			.executeTakeFirst();

		if (!user) {
			throw new Error('Invalid credentials');
		}

		// Verify password
		const isValidPassword = await compare(password, user.passwordHash);
		if (!isValidPassword) {
			throw new Error('Invalid credentials');
		}

		// Create session
		const session = await createSession(user.code, cookies);
		if (!session) {
			throw new Error('Failed to create session');
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
export async function signup(data: SignupData, cookies: Cookies) {
	try {
		const { email, password, name, lastName } = data;

		// Check if user already exists
		const existingUser = await db
			.selectFrom('users')
			.select('code')
			.where('email', '=', email.toLowerCase())
			.executeTakeFirst();

		if (existingUser) {
			throw new Error('User already exists');
		}

		// Hash password
		const passwordHash = await hash(password, 12);

		// Create user
		const newUser = await db
			.insertInto('users')
			.values({
				email: email.toLowerCase(),
				passwordHash: passwordHash,
				name: name || null,
				lastName: lastName || null,
				isEmailVerified: false,
				isSuperAdmin: false
			})
			.returning(['code', 'email', 'name'])
			.executeTakeFirstOrThrow();

		// Create session
		const session = await createSession(newUser.code, cookies);
		if (!session) {
			throw new Error('Failed to create session');
		}

		return {
			success: true,
			user: session.user
		};
	} catch (error) {
		console.error('Signup error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Signup failed'
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
		console.error('Logout error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Logout failed'
		};
	}
}

/**
 * Check if user has permission for an action
 */
export async function hasPermission(
	userCode: string,
	entity: string,
	action: string
): Promise<boolean> {
	try {
		const permission = await db
			.selectFrom('permissions')
			.select('code')
			.where('userCode', '=', userCode)
			.where('entity', '=', entity)
			.where('action', '=', action)
			.executeTakeFirst();

		return !!permission;
	} catch (error) {
		console.error('Permission check error:', error);
		return false;
	}
}

/**
 * Grant permission to user
 */
export async function grantPermission(
	userCode: string,
	entity: string,
	action: string
): Promise<boolean> {
	try {
		await db
			.insertInto('permissions')
			.values({
				userCode: userCode,
				entity,
				action
			})
			.onConflict((oc) => oc.columns(['userCode', 'entity', 'action']).doNothing())
			.execute();

		return true;
	} catch (error) {
		console.error('Grant permission error:', error);
		return false;
	}
}

/**
 * Revoke permission from user
 */
export async function revokePermission(
	userCode: string,
	entity: string,
	action: string
): Promise<boolean> {
	try {
		await db
			.deleteFrom('permissions')
			.where('userCode', '=', userCode)
			.where('entity', '=', entity)
			.where('action', '=', action)
			.execute();

		return true;
	} catch (error) {
		console.error('Revoke permission error:', error);
		return false;
	}
}
