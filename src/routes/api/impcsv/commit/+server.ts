import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { StudentRegisterData } from '$lib/csvProcessor';

/**
 * API endpoint for committing validated CSV data to the database
 * Receives validated rows and inserts them into the students and registers tables
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Get the validated data from the request
		const body = await request.json();
		const { validRows, level_code } = body;

		if (!Array.isArray(validRows) || validRows.length === 0) {
			return json(
				{
					success: false,
					error: {
						message: 'No hay datos válidos para importar'
					}
				},
				{ status: 400 }
			);
		}

		if (!level_code) {
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

		const user_code = locals.session?.user.id;
		if (!user_code) {
			return json(
				{
					success: false,
					error: {
						message: 'Usuario no autenticado'
					}
				},
				{ status: 401 }
			);
		}

		// Results tracking
		const results = {
			inserted: 0,
			errors: [] as { row: StudentRegisterData; error: string }[],
			duplicates: [] as { row: StudentRegisterData; error: string }[]
		};

		// Process each row in a transaction
		for (const row of validRows) {
			const { error: searchError } = await locals.supabase
				.from('students')
				.select('code')
				.or(`email.eq.${row.email},and(name.eq.${row.name},last_name.eq.${row.last_name})`)
				.maybeSingle();

			if (searchError) {
				results.errors.push({
					row,
					error: `Error al buscar estudiante: ${searchError.message}`
				});
				continue;
			}

			// Check if roll_code is already used in this level
			const { data: existingRoll, error: rollError } = await locals.supabase
				.from('registers')
				.select('code')
				.eq('level_code', level_code)
				.eq('roll_code', row.roll_code)
				.maybeSingle();

			if (rollError) {
				results.errors.push({
					row,
					error: `Error al verificar código de matrícula: ${rollError.message}`
				});
				continue;
			}

			if (existingRoll) {
				results.duplicates.push({
					row,
					error: `El código de matrícula '${row.roll_code}' ya está en uso en este nivel`
				});
				continue;
			}

			// Start a transaction
			const { error: transactionError } = await locals.supabase.rpc('import_student_register', {
				p_name: row.name,
				p_last_name: row.last_name,
				p_phone: row.phone,
				p_email: row.email,
				p_level_code: level_code,
				p_group_name: row.group_name,
				p_roll_code: row.roll_code,
				p_user_code: user_code
			});

			if (transactionError) {
				results.errors.push({
					row,
					error: `Error en la transacción: ${transactionError.message}`
				});
			} else {
				results.inserted++;
			}
		}

		return json({
			success: true,
			data: results
		});
	} catch (error) {
		console.error('Error committing CSV data:', error);
		const message = error instanceof Error ? error.message : 'Error desconocido';

		return json(
			{
				success: false,
				error: {
					message: `Error al guardar los datos: ${message}`
				}
			},
			{ status: 500 }
		);
	}
};
