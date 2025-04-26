// src/routes/api/impcsv/commit/+server.ts
import { json, type RequestHandler } from '@sveltejs/kit';
import {
	CsvProcessorErrorCode,
	type StudentRegisterData,
	type CommitResult
} from '$lib/csvProcessor';
import { ApiErrorCode, createApiError, type ApiResponse } from '$lib/types/apiError';

// Constants for batch processing
const BATCH_SIZE = 100; // Process 100 records at a time for better performance

// Error message mapping for common database errors
const ERROR_PATTERNS = [
	{
		pattern: 'uq_registers_roll_code',
		code: CsvProcessorErrorCode.DUPLICATE_ROLL_CODE,
		getMessage: (row: StudentRegisterData) => `Código '${row.roll_code}' ya existe.`
	},
	{
		pattern: 'uq_student_name_lastname',
		code: CsvProcessorErrorCode.DUPLICATE_NAME,
		getMessage: (row: StudentRegisterData) => `Estudiante '${row.name} ${row.last_name}' ya existe.`
	},
	{
		pattern: 'ck_registers_group',
		code: CsvProcessorErrorCode.INVALID_VALUE,
		getMessage: (row: StudentRegisterData) =>
			`Grupo '${row.group_name}' inválido. Debe ser A, B, C o D.`
	},
	{
		pattern: 'Invalid group_name',
		code: CsvProcessorErrorCode.INVALID_VALUE,
		getMessage: (row: StudentRegisterData) =>
			`Grupo '${row.group_name}' inválido. Debe ser A, B, C o D.`
	},
	{
		pattern: 'invalid input syntax for type uuid',
		code: CsvProcessorErrorCode.INVALID_FORMAT,
		getMessage: () => `Error de tipo de datos: El código de nivel no es un UUID válido.`
	}
];

/**
 * API endpoint for committing validated CSV data.
 * Calls the import_student_register PostgreSQL function for each row.
 * Implements batch processing for better performance with large datasets.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	let levelCode: string | undefined; // For context in catch block

	try {
		const body = await request.json();
		levelCode = typeof body.level_code === 'string' ? body.level_code : undefined;
		const rawValidRows = body.validRows;

		// --- Input Validation ---
		if (!levelCode) {
			return json(
				{
					success: false,
					error: createApiError(ApiErrorCode.VALIDATION_ERROR, 'Nivel no proporcionado o inválido')
				},
				{ status: 400 }
			);
		}

		// Filter ensure validRows is an array of actual StudentRegisterData objects
		const validRows = (Array.isArray(rawValidRows) ? rawValidRows : []).filter(
			(row): row is StudentRegisterData =>
				row &&
				typeof row === 'object' &&
				typeof row.name === 'string' &&
				typeof row.last_name === 'string' &&
				typeof row.roll_code === 'string' // Ensure required fields exist and are strings
		);

		if (validRows.length === 0) {
			return json(
				{
					success: false,
					error: createApiError(
						ApiErrorCode.CSV_NO_VALID_ROWS,
						'No hay datos válidos para importar'
					)
				},
				{ status: 400 }
			);
		}

		const user_code = locals.session?.user.id;
		if (!user_code) {
			return json(
				{
					success: false,
					error: createApiError(ApiErrorCode.UNAUTHORIZED, 'Usuario no autenticado')
				},
				{ status: 401 }
			);
		}

		// --- Results Tracking ---
		const results: CommitResult = {
			inserted: 0,
			errors: [],
			duplicates: [],
			existingStudents: []
		};

		// --- Process rows in batches ---
		for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
			const batch = validRows.slice(i, i + BATCH_SIZE);

			// Process each row in the batch
			const batchPromises = batch.map(async (row) => {
				try {
					// At this point levelCode is guaranteed to be defined due to earlier validation
					const { error: rpcError } = await locals.supabase.rpc('import_student_register', {
						p_name: row.name,
						p_last_name: row.last_name,
						p_phone: row.phone || '',
						p_email: row.email || '',
						p_level_code: levelCode as string,
						p_group_name: row.group_name,
						p_roll_code: row.roll_code,
						p_user_code: user_code
					});

					if (rpcError) {
						// Check for specific error patterns
						for (const pattern of ERROR_PATTERNS) {
							if (rpcError.message.includes(pattern.pattern)) {
								return {
									success: false,
									row,
									error: pattern.getMessage(row),
									code: pattern.code
								};
							}
						}

						// Generic error for other RPC issues
						return {
							success: false,
							row,
							error: `Error al procesar: ${rpcError.message}`,
							code: CsvProcessorErrorCode.UNEXPECTED_ERROR
						};
					}

					return { success: true, row };
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					return {
						success: false,
						row,
						error: `Error inesperado: ${message}`,
						code: CsvProcessorErrorCode.UNEXPECTED_ERROR
					};
				}
			});

			// Wait for all promises in the batch to resolve
			const batchResults = await Promise.all(batchPromises);

			// Process batch results
			batchResults.forEach((result) => {
				if (result.success) {
					results.inserted++;
				} else if (result.error && result.code) {
					// Sort errors by type
					if (result.code === CsvProcessorErrorCode.DUPLICATE_ROLL_CODE) {
						results.duplicates.push({
							row: result.row,
							error: result.error,
							code: result.code
						});
					} else {
						results.errors.push({
							row: result.row,
							error: result.error,
							code: result.code
						});
					}
				} else {
					// Fallback for unexpected result structure
					results.errors.push({
						row: result.row,
						error: 'Error desconocido durante el procesamiento',
						code: CsvProcessorErrorCode.UNEXPECTED_ERROR
					});
				}
			});
		}

		// Calculate summary statistics
		const totalProcessed = validRows.length;
		const successRate =
			totalProcessed > 0 ? Math.round((results.inserted / totalProcessed) * 100) : 0;

		// Add summary to results
		results.summary = {
			totalProcessed,
			successRate
		};

		return json({
			success: true,
			data: results
		} as ApiResponse<CommitResult>);
	} catch (error: unknown) {
		// --- Enhanced Error Handling ---
		console.error(`Error committing CSV data:`, error);

		let status = 500;
		let errorCode = ApiErrorCode.UNKNOWN_ERROR;
		let message = 'Error interno del servidor durante la importación.';

		if (error instanceof SyntaxError) {
			message = 'Error en el formato de la solicitud.';
			status = 400; // Bad Request
			errorCode = ApiErrorCode.REQUEST_FORMAT_ERROR;
		} else if (error instanceof Error) {
			message = error.message.startsWith('Error: ') ? error.message.substring(7) : error.message;

			// Determine more specific error codes based on error message
			if (message.includes('verificar matrículas') || message.includes('verificar estudiantes')) {
				errorCode = ApiErrorCode.DB_QUERY_ERROR;
			}
		}

		return json(
			{
				success: false,
				error: createApiError(errorCode, message)
			} as ApiResponse<never>,
			{ status }
		);
	}
};
