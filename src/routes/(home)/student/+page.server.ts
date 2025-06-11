import { getLevels } from '$lib/data/levels';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { studentSchema } from '$lib/schemas/student';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.session?.user.id;
	let levels = [];
	if (userId) {
		levels = await getLevels(locals.supabase, userId);
	}
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
		const roll_code = formData.get('roll_code') as string;
		const user_code = locals.session?.user.id;

		if (!user_code) return fail(401, { error: 'User not authenticated' });

		// Validate data with Zod schema
		const result = studentSchema.safeParse({
			name,
			last_name,
			phone,
			email,
			level_code,
			group_name,
			roll_code
		});

		if (!result.success) {
			const firstError = result.error.errors[0];
			return fail(400, {
				error: firstError.message || 'Validation error',
				errors: result.error.format()
			});
		}

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
					.update({ group_name, level_code, roll_code })
					.eq('code', existingRegister.code);

				if (registerError) return fail(400, { error: registerError.message });
			} else {
				// Create new register
				const { error: registerError } = await locals.supabase.from('registers').insert({
					student_code: existing_student_code,
					level_code,
					group_name,
					user_code,
					roll_code
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
			roll_code
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
		const roll_code = formData.get('roll_code') as string;

		const result = studentSchema.safeParse({
			name,
			last_name,
			phone,
			email,
			level_code,
			group_name,
			roll_code
		});

		if (!result.success) {
			const firstError = result.error.errors[0];
			return fail(400, {
				error: firstError.message || 'Validation error',
				errors: result.error.format()
			});
		}

		// Get current register to check for group/level change
		const { data: currentRegister, error: currentRegisterError } = await locals.supabase
			.from('registers')
			.select('group_name, level_code, code')
			.eq('student_code', code)
			.order('created_at', { ascending: false })
			.limit(1)
			.single();

		if (currentRegisterError) return fail(400, { error: currentRegisterError.message });

		// Check if group or level is changing
		const isGroupChanging = currentRegister.group_name !== group_name;
		const isLevelChanging = currentRegister.level_code !== level_code;

		// If group/level is changing, automatically delete evaluation data
		if (isGroupChanging || isLevelChanging) {
			// Delete eval_answers first (they reference eval_questions)
			await locals.supabase.from('eval_answers').delete().eq('register_code', currentRegister.code);

			// Delete eval_results (they reference evals and eval_sections)
			await locals.supabase.from('eval_results').delete().eq('register_code', currentRegister.code);
		}

		const { error: studentError } = await locals.supabase
			.from('students')
			.update({ name, last_name, phone, email })
			.eq('code', code);

		if (studentError) return fail(400, { error: studentError.message });

		const { error: registerError } = await locals.supabase
			.from('registers')
			.update({ level_code, group_name, roll_code })
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
