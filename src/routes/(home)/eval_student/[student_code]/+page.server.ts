import type { PageServerLoad } from './$types';
import { getLevels } from '$lib/data/levels';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { student_code } = params;

	if (!student_code) {
		throw error(404, 'Código de estudiante no proporcionado');
	}

	const userId = locals.session?.user.id;
	let levels = [];

	if (userId) {
		levels = await getLevels(locals.supabase, userId);
	}

	// Get student information
	const { data: student, error: studentError } = await locals.supabase
		.from('students')
		.select('name, last_name, email')
		.eq('code', student_code)
		.single();

	if (studentError) {
		console.error('Error fetching student:', studentError);
		throw error(404, 'Estudiante no encontrado');
	}

	return {
		student: {
			code: student_code,
			name: student.name,
			last_name: student.last_name,
			email: student.email
		},
		levels,
		title: `Resultados de ${student.name} ${student.last_name}`
	};
};
