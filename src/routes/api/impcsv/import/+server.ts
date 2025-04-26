import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importCsv } from '$lib/csvProcessor';
import type { ImportResult } from '$lib/csvProcessor';

/**
 * API endpoint for importing CSV data
 * Receives a CSV file, processes it, and returns the validation results
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Get the form data from the request
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const levelCode = formData.get('level_code') as string | null;

		// Validate inputs
		if (!file) {
			return json(
				{
					success: false,
					error: {
						message: 'No se ha proporcionado un archivo CSV'
					}
				},
				{ status: 400 }
			);
		}

		if (!levelCode) {
			return json(
				{
					success: false,
					error: {
						message: 'No se ha proporcionado un nivel'
					}
				},
				{ status: 400 }
			);
		}

		// Convert the file to a buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Process the CSV file
		const result: ImportResult = await importCsv(buffer);

		// Return the processed data
		return json({
			success: true,
			data: {
				...result,
				level_code: levelCode
			}
		});
	} catch (error) {
		console.error('Error processing CSV:', error);
		const message = error instanceof Error ? error.message : 'Error desconocido';

		return json(
			{
				success: false,
				error: {
					message: `Error al procesar el archivo CSV: ${message}`
				}
			},
			{ status: 500 }
		);
	}
};
