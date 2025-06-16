import type { Cookies } from '@sveltejs/kit';
import { generateToken, verifyToken } from './jwt';
import { db } from '$lib/database';

export interface User {
	code: string;
	email: string;
	name: string | null;
	lastLogin: Date | null;
}

export interface Session {
	user: User;
	token: string;
	expiresAt: number;
}

const SESSION_COOKIE_NAME = 'nextya_session';
const COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'strict' as const,
	maxAge: 60 * 60 * 8, // 8 hours
	path: '/'
};

/**
 * Create a new session for a user
 */
export async function createSession(userCode: string, cookies: Cookies): Promise<Session | null> {
	try {
		// Get user from database
		const user = await db
			.selectFrom('users')
			.select(['code', 'email', 'name', 'lastLogin'])
			.where('code', '=', userCode)
			.executeTakeFirst();

		if (!user) {
			console.error('User not found for session creation:', userCode);
			return null;
		}

		// Generate JWT token
		const token = generateToken({ userCode: user.code, email: user.email });
		const payload = verifyToken(token);
		
		if (!payload) {
			console.error('Failed to verify generated token');
			return null;
		}

		// Set session cookie
		cookies.set(SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);

		// Update last login
		await db
			.updateTable('users')
			.set({ lastLogin: new Date() })
			.where('code', '=', userCode)
			.execute();

		return {
			user: {
				code: user.code,
				email: user.email,
				name: user.name,
				lastLogin: user.lastLogin
			},
			token,
			expiresAt: payload.exp! * 1000
		};
	} catch (error) {
		console.error('Error creating session:', error);
		return null;
	}
}

/**
 * Get current session from cookies
 */
export async function getSession(cookies: Cookies): Promise<Session | null> {
	try {
		const token = cookies.get(SESSION_COOKIE_NAME);
		if (!token) {
			return null;
		}

		// Verify token
		const payload = verifyToken(token);
		if (!payload) {
			destroySession(cookies);
			return null;
		}

		// Get fresh user data
		const user = await db
			.selectFrom('users')
			.select(['code', 'email', 'name', 'lastLogin'])
			.where('code', '=', payload.userCode)
			.executeTakeFirst();

		if (!user) {
			destroySession(cookies);
			return null;
		}

		return {
			user: {
				code: user.code,
				email: user.email,
				name: user.name,
				lastLogin: user.lastLogin
			},
			token,
			expiresAt: payload.exp! * 1000
		};
	} catch (error) {
		console.error('Error getting session:', error);
		destroySession(cookies);
		return null;
	}
}

/**
 * Destroy current session
 */
export function destroySession(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

/**
 * Refresh session with new token
 */
export async function refreshSession(cookies: Cookies): Promise<Session | null> {
	const currentSession = await getSession(cookies);
	if (!currentSession) {
		return null;
	}

	// Create new session with same user
	return createSession(currentSession.user.code, cookies);
}
