import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('students:load');

	const { data: studentRegisters, error } = await locals.supabase
		.from('student_registers')
		.select('*');

	if (error) {
		console.error('Error loading student registers:', error);
		return { studentRegisters: [] };
	}

	return { studentRegisters, title: 'Estudiantes' };
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

		const { data: student, error: studentError } = await locals.supabase
			.from('students')
			.insert({ name, last_name, phone, email, user_code })
			.select()
			.single();

		if (studentError || !student) {
			return fail(400, { error: studentError?.message || 'Error creating student' });
		}

		const { error: registerError } = await locals.supabase.from('registers').insert({
			student_code: student.code,
			level_code,
			group_name,
			user_code,
			roll_code: '0000'
		});

		if (registerError) {
			await locals.supabase.from('students').delete().eq('code', student.code);
			return fail(400, { error: registerError.message });
		}

		return { type: 'success' };
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const code = formData.get('code') as string;
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const phone = formData.get('phone') as string | null;
		const email = formData.get('email') as string;
		const level_code = formData.get('level') as string;
		const group_name = formData.get('group_name') as string;

		const { error: studentError } = await locals.supabase
			.from('students')
			.update({ name, last_name, phone, email })
			.eq('code', code);

		if (studentError) return fail(400, { error: studentError.message });

		const { error: registerError } = await locals.supabase
			.from('registers')
			.update({ level_code, group_name })
			.eq('student_code', code);

		if (registerError) return fail(400, { error: registerError.message });

		return { type: 'success' };
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const code = formData.get('code') as string;

		const { error: registerError } = await locals.supabase
			.from('registers')
			.delete()
			.eq('student_code', code);

		if (registerError) return fail(400, { error: registerError.message });

		const { error: studentError } = await locals.supabase
			.from('students')
			.delete()
			.eq('code', code);

		if (studentError) return fail(400, { error: studentError.message });

		return { type: 'success' };
	}
};
