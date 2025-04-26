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

/**
 * API endpoint for committing validated CSV data.
 * Performs bulk checks for existing roll_codes (within the level) and potentially existing students (by name).
 * Calls the import_student_register PostgreSQL function for rows without duplicate roll_codes.
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

		// Since we've already checked for duplicates in the import endpoint,
		// we can skip the redundant checks here and process all rows directly.
		// The import_student_register function will handle any remaining edge cases.

		const rowsToProcess = validRows;

		// Log the number of rows to process
		console.log(`Processing ${rowsToProcess.length} rows in batches of ${BATCH_SIZE}`);

		// --- 5. Process rows in batches ---
		// Split rows into batches for more efficient processing
		for (let i = 0; i < rowsToProcess.length; i += BATCH_SIZE) {
			const batch = rowsToProcess.slice(i, i + BATCH_SIZE);

			// Process each row in the batch
			const batchPromises = batch.map(async (row) => {
				try {
					// Ensure levelCode is defined (it should be at this point)
					if (!levelCode) {
						return {
							success: false,
							row,
							error: 'Nivel no definido',
							code: CsvProcessorErrorCode.UNEXPECTED_ERROR
						};
					}

					const { error: rpcError } = await locals.supabase.rpc('import_student_register', {
						p_name: row.name,
						p_last_name: row.last_name,
						p_phone: row.phone || '',
						p_email: row.email || '',
						p_level_code: levelCode,
						p_group_name: row.group_name,
						p_roll_code: row.roll_code,
						p_user_code: user_code
					});

					if (rpcError) {
						console.error(
							`RPC Error for roll_code ${row.roll_code} (Name: ${row.name} ${row.last_name}):`,
							rpcError
						);

						// Check if it's the roll_code unique constraint violation
						if (rpcError.message.includes('uq_registers_roll_code')) {
							return {
								success: false,
								row,
								error: `Código '${row.roll_code}' ya existe.`,
								code: CsvProcessorErrorCode.DUPLICATE_ROLL_CODE
							};
						} else {
							// Generic error for other RPC issues
							return {
								success: false,
								row,
								error: `Error al procesar: ${rpcError.message}`,
								code: CsvProcessorErrorCode.UNEXPECTED_ERROR
							};
						}
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

			// Log batch results
			console.log(
				`Batch completed: ${batchResults.length} rows processed, ${batchResults.filter((r) => r.success).length} successful`
			);

			// Process batch results
			batchResults.forEach((result) => {
				if (result.success) {
					results.inserted++;
				} else if (result.error && result.code) {
					// Ensure we have error message and code
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

		// Calculate summary statistics for better UI feedback
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
		console.error(`Error committing CSV data (Level: ${levelCode ?? 'N/A'}):`, error);

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
			if (message.includes('verificar matrículas')) {
				errorCode = ApiErrorCode.DB_QUERY_ERROR;
			} else if (message.includes('verificar estudiantes')) {
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
