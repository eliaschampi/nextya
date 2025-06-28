import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { student_code } = params;

	if (!student_code) {
		return json({ error: 'Código de estudiante no proporcionado' }, { status: 400 });
	}

	try {
		// Get student information
		const student = await locals.db
			.selectFrom('students')
			.select(['name', 'last_name', 'email'])
			.where('code', '=', student_code)
			.executeTakeFirst();

		if (!student) {
			return json({ error: 'Estudiante no encontrado' }, { status: 404 });
		}

		return json({
			code: student_code,
			name: student.name,
			last_name: student.last_name,
			email: student.email
		});
	} catch (error) {
		console.error('Error in student API:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
