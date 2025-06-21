import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals, url }) => {
	const searchQuery = url.searchParams.get('search');

	if (!searchQuery) {
		return json([]);
	}

	try {
		const students = await locals.db
			.selectFrom('students')
			.selectAll()
			.where((eb) =>
				eb.or([
					eb('name', 'ilike', `%${searchQuery}%`),
					eb('last_name', 'ilike', `%${searchQuery}%`)
				])
			)
			.execute();

		return json(students);
	} catch (error) {
		console.error('Error searching students:', error);
		return json({ error: 'Error interno del servidor al buscar estudiantes' }, { status: 500 });
	}
};
