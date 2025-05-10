import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { eval_code } = params;

	if (!eval_code) {
		return json({ error: 'Código de evaluación no proporcionado' }, { status: 400 });
	}

	// Usar la función RPC para obtener los resultados
	const { data, error } = await locals.supabase.rpc('get_register_eval_results', {
		p_eval_code: eval_code
	});

	if (error) {
		console.error('Error al obtener resultados de evaluación:', error);
		return json({ error: 'Error al obtener resultados' }, { status: 500 });
	}

	// Los resultados ya vienen en el formato correcto desde la función RPC
	return json(data);
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
			const { error: deleteAllError } = await locals.supabase
				.from('eval_results')
				.delete()
				.eq('eval_code', eval_code);

			if (deleteAllError) {
				console.error('Error eliminando todos los resultados:', deleteAllError);
				return json({ error: 'Error al eliminar todos los resultados' }, { status: 500 });
			}

			return json({ success: true, message: 'Todos los resultados eliminados correctamente' });
		} else {
			// Delete specific results
			const { error: deleteError } = await locals.supabase
				.from('eval_results')
				.delete()
				.in('code', resultIds)
				.eq('eval_code', eval_code);

			if (deleteError) {
				console.error('Error eliminando resultados específicos:', deleteError);
				return json({ error: 'Error al eliminar los resultados seleccionados' }, { status: 500 });
			}

			return json({
				success: true,
				message: `${resultIds.length} resultado(s) eliminado(s) correctamente`
			});
		}
	} catch {
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
