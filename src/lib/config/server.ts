// Server-side environment configuration for SvelteKit
// This file contains sensitive configuration that should ONLY be used on the server

import {
	DB_HOST,
	DB_USER,
	DB_PASSWORD,
	DB_NAME,
	DB_PORT,
	JWT_SECRET,
	JWT_EXPIRES_IN,
	NODE_ENV
} from '$env/static/private';

// Database configuration - only available on server
export const dbConfig = {
	host: DB_HOST || 'localhost',
	user: DB_USER || 'postgres',
	password: DB_PASSWORD || 'postgres',
	database: DB_NAME || 'nextya',
	port: parseInt(DB_PORT || '5432')
};

// JWT configuration - only available on server
export const jwtConfig = {
	secret: JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
	expiresIn: JWT_EXPIRES_IN || '8h'
};

// Environment configuration
export const envConfig = {
	isDevelopment: NODE_ENV === 'development',
	isProduction: NODE_ENV === 'production',
	nodeEnv: NODE_ENV || 'development'
};

// Server-side cookie configuration with proper security settings
export const serverCookieConfig = {
	httpOnly: true,
	secure: envConfig.isProduction,
	sameSite: 'strict' as const,
	maxAge: 60 * 60 * 8, // 8 hours
	path: '/'
};
