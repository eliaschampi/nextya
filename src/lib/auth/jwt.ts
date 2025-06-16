import jwt from 'jsonwebtoken';

export interface JWTPayload {
	userCode: string;
	email: string;
	iat?: number;
	exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '8h';

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: { userCode: string; email: string }): string {
	return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
	try {
		return jwt.verify(token, JWT_SECRET) as JWTPayload;
	} catch (error) {
		console.error('Fallo verificacion JWT:', error);
		return null;
	}
}

/**
 * Decode a JWT token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
	try {
		return jwt.decode(token) as JWTPayload;
	} catch (error) {
		console.error('Fallo decodificacion JWT:', error);
		return null;
	}
}
