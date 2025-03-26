import { getLevels } from '$lib/data/levels';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	const levels = await getLevels(locals.supabase);
	return { levels, title: 'Estudiantes' };
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
		if (!user_code) return fail(401, { error: 'User not authenticated' });
		const existing_student_code = formData.get('code') as string | null;

		// If we have an existing student code, we're updating an existing student
		if (existing_student_code) {
			// Update student data
			const { error: studentError } = await locals.supabase
				.from('students')
				.update({ name, last_name, phone, email })
				.eq('code', existing_student_code);

			if (studentError) return fail(400, { error: studentError.message });

			// Check if student already has a register for this level
			const { data: existingRegister, error: registerCheckError } = await locals.supabase
				.from('registers')
				.select('code')
				.eq('student_code', existing_student_code)
				.eq('level_code', level_code)
				.single();

			if (registerCheckError && registerCheckError.code !== 'PGRST116') {
				return fail(400, { error: registerCheckError.message });
			}

			if (existingRegister) {
				// Update existing register
				const { error: registerError } = await locals.supabase
					.from('registers')
					.update({ group_name, level_code })
					.eq('code', existingRegister.code);

				if (registerError) return fail(400, { error: registerError.message });
			} else {
				// Create new register
				const { error: registerError } = await locals.supabase.from('registers').insert({
					student_code: existing_student_code,
					level_code,
					group_name,
					user_code,
					roll_code: '0000' // Default roll code
				});

				if (registerError) return fail(400, { error: registerError.message });
			}

			return { type: 'success' };
		}

		// Create new student
		const { data: student, error: studentError } = await locals.supabase
			.from('students')
			.insert({ name, last_name, phone, email, user_code })
			.select('code')
			.single();

		if (studentError || !student) {
			return fail(400, { error: studentError?.message || 'Error creating student' });
		}

		// Create new register
		const { error: registerError } = await locals.supabase.from('registers').insert({
			student_code: student.code,
			level_code,
			group_name,
			user_code,
			roll_code: '0000' // Default roll code
		});

		if (registerError) return fail(400, { error: registerError.message });

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

		// Update student data
		const { error: studentError } = await locals.supabase
			.from('students')
			.update({ name, last_name, phone, email })
			.eq('code', code);

		if (studentError) return fail(400, { error: studentError.message });

		// Update register data
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
		const register_code = formData.get('register_code') as string;
		const affect_student = formData.get('mode') as 'all' | 'only_register';
		const { error: registerError } = await locals.supabase
			.from('registers')
			.delete()
			.eq('code', register_code);

		if (registerError) return fail(400, { error: registerError.message });

		// 2. check if we have to delete the student
		if (affect_student === 'all') {
			const { error: studentError } = await locals.supabase
				.from('students')
				.delete()
				.eq('code', code);

			if (studentError) return fail(400, { error: studentError.message });
		}

		return { type: 'success' };
	}
};
