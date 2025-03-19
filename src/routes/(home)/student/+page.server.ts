import type { Student } from '../../../app';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, depends, url }) => {
	depends('students:load');

	const level_code = url.searchParams.get('level_code') || '';
	// Cargar todos los niveles
	const { data: levels, error: levelsError } = await locals.supabase.from('levels').select('*');

	// Cargar estudiantes solo si hay un level_code
	let studentRegisters: Student[] = [];
	if (level_code) {
		const { data, error } = await locals.supabase
			.from('student_registers')
			.select('*')
			.eq('level_code', level_code);

		if (!error && data) {
			// Mapear los datos a la estructura Student
			studentRegisters = data.map((item) => ({
				student_code: item.student_code || '',
				register_code: item.register_code || '',
				name: item.name || '',
				last_name: item.last_name || '',
				level_code: item.level || '',
				email: item.email || '',
				phone: item.phone,
				roll_code: item.roll_code || '',
				group_name: item.group_name || '',
				level: item.level || '',
				created_at: item.created_at || ''
			}));
		}
	}

	if (levelsError) {
		return { studentRegisters: [], levels: [], title: 'Estudiantes' };
	}

	return { studentRegisters, levels, title: 'Estudiantes' };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const phone = formData.get('phone') as string | null;
		const email = formData.get('email') as string;
		const level_code = formData.get('level') as string;
		const group_name = formData.get('group_name') as string;
		const user_code = locals.session?.user.id;

		// Verificar si el estudiante ya existe por email
		const { data: existingStudent, error: checkError } = await locals.supabase
			.from('students')
			.select('code')
			.eq('email', email)
			.single();

		let student_code: string;
		if (existingStudent && !checkError) {
			student_code = existingStudent.code;
		} else {
			// Crear estudiante si no existe
			const { data: student, error: studentError } = await locals.supabase
				.from('students')
				.insert({ name, last_name, phone, email, user_code })
				.select('code')
				.single();

			if (studentError || !student)
				return fail(400, { error: studentError?.message || 'Error creando estudiante' });
			student_code = student.code;
		}

		// Crear registro
		const { error: registerError } = await locals.supabase.from('registers').insert({
			student_code,
			level_code,
			group_name,
			user_code,
			roll_code: '0000' // Ajustar según tu lógica
		});

		if (registerError) return fail(400, { error: registerError.message });

		return { type: 'success' };
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const code = formData.get('code') as string; // student_code
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const phone = formData.get('phone') as string | null;
		const email = formData.get('email') as string;
		const level_code = formData.get('level') as string;
		const group_name = formData.get('group_name') as string;

		// Actualizar estudiante
		const { error: studentError } = await locals.supabase
			.from('students')
			.update({ name, last_name, phone, email })
			.eq('code', code);

		if (studentError) return fail(400, { error: studentError.message });

		// Actualizar registro (asumimos que el último registro es el relevante; ajustar si hay múltiples)
		const { error: registerError } = await locals.supabase
			.from('registers')
			.update({ level_code, group_name })
			.eq('student_code', code)
			.order('created_at', { ascending: false })
			.limit(1);

		if (registerError) return fail(400, { error: registerError.message });

		return { type: 'success' };
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const code = formData.get('code') as string;

		// Eliminar registros asociados
		const { error: registerError } = await locals.supabase
			.from('registers')
			.delete()
			.eq('student_code', code);

		if (registerError) return fail(400, { error: registerError.message });

		// Eliminar estudiante
		const { error: studentError } = await locals.supabase
			.from('students')
			.delete()
			.eq('code', code);

		if (studentError) return fail(400, { error: studentError.message });

		return { type: 'success' };
	}
};
