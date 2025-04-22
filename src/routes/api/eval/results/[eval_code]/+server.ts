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
