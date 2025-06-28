import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sql } from 'kysely';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { eval_code } = params;

	if (!eval_code) {
		return json({ error: 'Código de evaluación no proporcionado' }, { status: 400 });
	}

	try {
		// Use PostgreSQL function to get the results
		const data = await locals.db
			.selectFrom(sql`get_register_eval_results(${eval_code})`.as('results'))
			.selectAll()
			.execute();

		// Los resultados ya vienen en el formato correcto desde la función RPC
		return json(data);
	} catch (error) {
		console.error('Error al obtener resultados de evaluación:', error);
		return json({ error: 'Error al obtener resultados de evaluación' }, { status: 500 });
	}
};

/**
 * DELETE endpoint for removing evaluation results
 * Accepts an array of result IDs to delete in the request body
 */
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	const { eval_code } = params;

	if (!eval_code) {
		return json({ error: 'Código de evaluación no proporcionado' }, { status: 400 });
	}

	try {
		// Get the result IDs from the request body
		const body = await request.json();
		const { resultIds } = body as { resultIds: string[] };

		// If resultIds is empty, it means delete all results for this eval
		if (resultIds.length === 0) {
			// Delete all results for this evaluation
			await locals.db.deleteFrom('eval_results').where('eval_code', '=', eval_code).execute();

			return json({ success: true, message: 'Todos los resultados eliminados correctamente' });
		} else {
			// Delete specific results
			await locals.db
				.deleteFrom('eval_results')
				.where('code', 'in', resultIds)
				.where('eval_code', '=', eval_code)
				.execute();

			return json({
				success: true,
				message: `${resultIds.length} resultado(s) eliminado(s) correctamente`
			});
		}
	} catch (error) {
		console.error('Error deleting evaluation results:', error);
		return json({ error: 'Error interno del servidor al eliminar resultados' }, { status: 500 });
	}
};
