import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importCsv, createNameKey, CsvProcessorErrorCode } from '$lib/csvProcessor';
import type { ImportResult, StudentRegisterData } from '$lib/csvProcessor';

/**
 * Checks for duplicates in the database and moves them from validRows to omittedRows
 * @param result - The import result to modify
 * @param levelCode - The level code to check against
 * @param db - The database instance
 */
async function checkDatabaseDuplicates(
	result: ImportResult,
	levelCode: string,
	db: any
): Promise<void> {
	if (result.validRows.length === 0) return;

	try {
		// 1. Check for duplicate roll_codes in the database
		const rollCodesToCheck = result.validRows.map((row) => row.roll_code);

		const existingRollCodes = await db
			.selectFrom('registers')
			.select('roll_code')
			.where('level_code', '=', levelCode)
			.where('roll_code', 'in', rollCodesToCheck)
			.execute();

		// Create a set of existing roll codes for efficient lookup
		const existingRollCodeSet = new Set(existingRollCodes?.map((r: any) => r.rollCode) || []);

		// 2. Check for duplicate students by name + last_name
		// Create a map of name keys for efficient lookup
		const nameKeyMap = new Map<string, number>(); // nameKey -> index in validRows
		result.validRows.forEach((row, index) => {
			const nameKey = createNameKey(row.name, row.last_name);
			nameKeyMap.set(nameKey, index);
		});

		// Get all unique name+lastname pairs for the query
		const nameLastNamePairs = Array.from(nameKeyMap.keys()).map((key) => {
			const [name, lastName] = key.split('||');
			return { name, lastName };
		});

		// Query for existing students with the same name+last_name
		const existingStudents = await db
			.selectFrom('students')
			.select(['name', 'last_name'])
			.where((eb: any) => {
				const conditions = nameLastNamePairs.map((pair) =>
					eb.and([eb('name', 'ilike', pair.name), eb('last_name', 'ilike', pair.lastName)])
				);
				return eb.or(conditions);
			})
			.execute();

		// Create a set of existing name keys for efficient lookup
		const existingNameKeySet = new Set(
			existingStudents?.map((s: any) => createNameKey(s.name, s.lastName)) || []
		);

		// 3. Move duplicates from validRows to omittedRows
		// We need to process in reverse order to avoid index shifting when removing items
		const rowsToMove: {
			row: StudentRegisterData;
			reason: string;
			code: CsvProcessorErrorCode;
			rowNumber: number;
		}[] = [];

		result.validRows.forEach((row, index) => {
			// Check for duplicate roll_code in database
			if (existingRollCodeSet.has(row.roll_code)) {
				rowsToMove.push({
					row,
					reason: `Código '${row.roll_code}' ya existe en la base de datos.`,
					code: CsvProcessorErrorCode.DUPLICATE_ROLL_CODE,
					rowNumber: index + 1 // Assuming 1-based row numbers
				});
				return;
			}

			// Check for duplicate name+last_name in database
			const nameKey = createNameKey(row.name, row.last_name);
			if (existingNameKeySet.has(nameKey)) {
				rowsToMove.push({
					row,
					reason: `Estudiante '${row.name} ${row.last_name}' ya existe en la base de datos.`,
					code: CsvProcessorErrorCode.DUPLICATE_NAME,
					rowNumber: index + 1
				});
				return;
			}
		});

		// Remove duplicates from validRows and add to omittedRows
		// Sort by index in descending order to avoid index shifting
		rowsToMove.sort((a, b) => b.rowNumber - a.rowNumber);

		for (const item of rowsToMove) {
			// Find the index in the current validRows array (may have changed due to removals)
			const currentIndex = result.validRows.findIndex(
				(row) =>
					row.roll_code === item.row.roll_code &&
					row.name === item.row.name &&
					row.last_name === item.row.last_name
			);

			if (currentIndex !== -1) {
				// Remove from validRows
				result.validRows.splice(currentIndex, 1);

				// Add to omittedRows
				result.omittedRows.push({
					row: {
						name: item.row.name,
						last_name: item.row.last_name,
						phone: item.row.phone || undefined,
						email: item.row.email || undefined,
						group_name: item.row.group_name,
						roll_code: item.row.roll_code
					},
					rowNumber: item.rowNumber,
					reason: item.reason,
					code: item.code
				});
			}
		}
	} catch (error) {
		console.error('Error checking database duplicates:', error);
	}
}

/**
 * API endpoint for importing CSV data
 * Receives a CSV file, processes it, and returns the validation results
 * Performs validation and checks for duplicates in the database
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Get the form data from the request
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const levelCode = formData.get('level_code') as string | null;

		// Validate inputs
		if (!file) {
			return json({ error: 'No se ha proporcionado un archivo CSV' }, { status: 400 });
		}

		if (!levelCode) {
			return json({ error: 'No se ha proporcionado un nivel' }, { status: 400 });
		}

		// Check if file is empty
		if (file.size === 0) {
			return json({ error: 'El archivo CSV está vacío' }, { status: 400 });
		}

		// Leer el archivo como texto
		const text = await file.text();

		// Process the CSV file for basic validation and in-file duplicates
		const result: ImportResult = await importCsv(text);

		// Check for duplicates in the database
		if (result.validRows.length > 0) {
			await checkDatabaseDuplicates(result, levelCode, locals.db);
		}

		// Calculate summary statistics for better UI feedback
		const totalRows = result.validRows.length + result.omittedRows.length;
		const successRate = totalRows > 0 ? Math.round((result.validRows.length / totalRows) * 100) : 0;

		return json({
			success: true,
			data: {
				validRows: result.validRows,
				omittedRows: result.omittedRows,
				level_code: levelCode,
				summary: {
					totalProcessed: totalRows,
					validCount: result.validRows.length,
					omittedCount: result.omittedRows.length,
					successRate
				}
			}
		});
	} catch (error) {
		console.error('Error processing CSV:', error);
		return json({ error: 'Error al procesar el archivo CSV' }, { status: 500 });
	}
};
