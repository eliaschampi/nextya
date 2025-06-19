import { getLevels } from '$lib/data/levels';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { studentSchema } from '$lib/schemas/student';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.code;
	let levels: any[] = [];
	if (userId) {
		levels = await getLevels(userId);
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
		const user_code = locals.user?.code;

		if (!user_code) return fail(401, { error: 'Usuario no autenticado' });

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
			try {
				await locals.db
					.updateTable('students')
					.set({ name, last_name, phone, email })
					.where('code', '=', existing_student_code)
					.execute();
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Error actualizando estudiante';
				return fail(400, { error: message });
			}

			// Check if student already has a register for this level
			const existingRegister = await locals.db
				.selectFrom('registers')
				.select('code')
				.where('student_code', '=', existing_student_code)
				.where('level_code', '=', level_code)
				.executeTakeFirst();

			try {
				if (existingRegister) {
					// Update existing register
					await locals.db
						.updateTable('registers')
						.set({ group_name, level_code, roll_code })
						.where('code', '=', existingRegister.code)
						.execute();
				} else {
					// Create new register

					await locals.db
						.insertInto('registers')
						.values({
							student_code: existing_student_code,
							level_code,
							group_name,
							user_code,
							roll_code
						})
						.execute();

				}
				return { type: 'success' };
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Error actualizando registro';
				return fail(400, { error: message });
			}

		}

		// Create new student
		try {

			const student = await locals.db
				.insertInto('students')
				.values({ name, last_name, phone, email, user_code })
				.returning('code')
				.executeTakeFirstOrThrow();

			// Create new register
			await locals.db
				.insertInto('registers')
				.values({
					student_code: student.code,
					level_code,
					group_name,
					user_code,
					roll_code
				})
				.execute();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error creando estudiante y registro';
			return fail(400, { error: message });
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
				error: firstError.message || 'Error de validación',
				errors: result.error.format()
			});
		}

		try {
			// Get current register to check for group/level change
			const currentRegister = await locals.db
				.selectFrom('registers')
				.select(['group_name', 'level_code', 'code'])
				.where('student_code', '=', code)
				.orderBy('created_at', 'desc')
				.limit(1)
				.executeTakeFirst();

			if (!currentRegister) {
				return fail(400, { error: 'No se encontró registro para el estudiante' });
			}

			// Check if group or level is changing
			const isGroupChanging = currentRegister.group_name !== group_name;
			const isLevelChanging = currentRegister.level_code !== level_code;

			// If group/level is changing, automatically delete evaluation data
			if (isGroupChanging || isLevelChanging) {
				// Delete eval_answers first (they reference eval_questions)
				await locals.db
					.deleteFrom('eval_answers')
					.where('register_code', '=', currentRegister.code)
					.execute();

				// Delete eval_results (they reference evals and eval_sections)
				await locals.db
					.deleteFrom('eval_results')
					.where('register_code', '=', currentRegister.code)
					.execute();
			}

			await locals.db
				.updateTable('students')
				.set({ name, last_name, phone, email })
				.where('code', '=', code)
				.execute();

			await locals.db
				.updateTable('registers')
				.set({ level_code, group_name, roll_code })
				.where('student_code', '=', code)
				.execute();

			return { type: 'success' };

		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error actualizando estudiante';
			return fail(400, { error: message });
		}

	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const code = formData.get('code') as string;
		const register_code = formData.get('register_code') as string;
		const affect_student = formData.get('mode') as 'all' | 'only_register';

		try {
			await locals.db.deleteFrom('registers').where('code', '=', register_code).execute();

			if (affect_student === 'all') {
				await locals.db.deleteFrom('students').where('code', '=', code).execute();
			}
			return { type: 'success' };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error eliminando estudiante';
			return fail(400, { error: message });
		}
	}
};
