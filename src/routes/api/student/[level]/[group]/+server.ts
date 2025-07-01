/**
 * STUDENTS BY LEVEL AND GROUP API - Modern Clean Architecture
 *
 * ARCHITECTURE PRINCIPLE: Direct Kysely database access for simplicity and consistency
 */

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { level, group } = params;

	if (!level || !group) {
		return json({ error: 'Código de nivel o grupo no proporcionado' }, { status: 400 });
	}

	try {
		const students = await locals.db
			.selectFrom('students')
			.innerJoin('registers', 'registers.student_code', 'students.code')
			.selectAll('students')
			.select(['registers.roll_code', 'registers.group_name'])
			.where('registers.level_code', '=', level)
			.where('registers.group_name', '=', group)
			.orderBy('registers.roll_code', 'asc')
			.execute();

		return json(students);
	} catch (error) {
		console.error('Error fetching students by level and group:', error);
		return json({ error: 'Error interno del servidor al obtener estudiantes' }, { status: 500 });
	}
};
