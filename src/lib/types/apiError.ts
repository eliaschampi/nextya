// src/lib/types/apiError.ts

/**
 * Códigos de error estandarizados para la API
 * Permite un manejo consistente de errores en el frontend
 */
export enum ApiErrorCode {
	// Errores generales
	UNKNOWN_ERROR = 'UNKNOWN_ERROR',
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	UNAUTHORIZED = 'UNAUTHORIZED',
	FORBIDDEN = 'FORBIDDEN',
	NOT_FOUND = 'NOT_FOUND',
	REQUEST_FORMAT_ERROR = 'REQUEST_FORMAT_ERROR',

	// Errores de base de datos
	DB_QUERY_ERROR = 'DB_QUERY_ERROR',
	DB_CONNECTION_ERROR = 'DB_CONNECTION_ERROR',
	DB_CONSTRAINT_ERROR = 'DB_CONSTRAINT_ERROR',

	// Errores específicos de CSV
	CSV_PARSE_ERROR = 'CSV_PARSE_ERROR',
	CSV_FORMAT_ERROR = 'CSV_FORMAT_ERROR',
	CSV_ENCODING_ERROR = 'CSV_ENCODING_ERROR',
	CSV_MISSING_FILE = 'CSV_MISSING_FILE',
	CSV_MISSING_LEVEL = 'CSV_MISSING_LEVEL',
	CSV_EMPTY_ERROR = 'CSV_EMPTY_ERROR',
	CSV_NO_VALID_ROWS = 'CSV_NO_VALID_ROWS'
}

/**
 * Estructura estandarizada de error para respuestas de API
 */
export interface ApiError {
	code: ApiErrorCode;
	message: string;
	details?: unknown;
}

/**
 * Estructura estandarizada de respuesta para endpoints de API
 */
export type ApiResponse<T> = { success: true; data: T } | { success: false; error: ApiError };

/**
 * Crea un objeto de error estandarizado para respuestas de API
 */
export function createApiError(code: ApiErrorCode, message: string, details?: unknown): ApiError {
	return {
		code,
		message,
		details
	};
}
