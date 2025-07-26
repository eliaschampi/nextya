import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sql } from 'kysely';

/**
 * GET endpoint for course score distribution data
 * Returns score distribution (approved, middle, failed) for a specific course in a level and group
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const { level_code, course_code } = params;
	const group_name = url.searchParams.get('group_name');

	if (!level_code || !course_code || !group_name) {
		return json(
			{ error: 'Código de nivel, código de curso o nombre de grupo no proporcionado' },
			{ status: 400 }
		);
	}

	try {
		// Call the database function
		const result = await sql<{
			approved: number;
			middle: number;
			failed: number;
			approved_count: number;
			middle_count: number;
			failed_count: number;
			total_count: number;
		}>`SELECT * FROM get_course_score_distribution(${level_code}, ${group_name}, ${course_code})`.execute(
			locals.db
		);

		if (!result.rows || result.rows.length === 0) {
			return json({
				approved: 0,
				middle: 0,
				failed: 0,
				approvedCount: 0,
				middleCount: 0,
				failedCount: 0,
				totalCount: 0
			});
		}

		const data = result.rows[0];

		// Return formatted data
		return json({
			approved: Number(data.approved),
			middle: Number(data.middle),
			failed: Number(data.failed),
			approvedCount: Number(data.approved_count),
			middleCount: Number(data.middle_count),
			failedCount: Number(data.failed_count),
			totalCount: Number(data.total_count)
		});
	} catch (error) {
		console.error('Error en endpoint de distribución de puntajes por curso:', error);
		return json({ error: 'Error al procesar datos de distribución' }, { status: 500 });
	}
};
