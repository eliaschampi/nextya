import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { level, group } = params;

	if (!level || !group || !(await locals.can('students:read'))) {
		return json([]);
	}

	try {
		const students = await locals.db
			.selectFrom('student_registers')
			.selectAll()
			.where('level_code', '=', level)
			.where('group_name', '=', group)
			.execute();

		return json(students);
	} catch {
		return json({ error: 'Ocurrio un error del servidor' }, { status: 500 });
	}
};
