import { getLevels } from '$lib/data/levels';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { validateStudent } from '$lib/schemas/student';
import type { DB } from '$lib/types';
import type { Kysely } from 'kysely';

// Reusable eval deletion function
async function deleteEvals(db: Kysely<DB>, registerCode: string) {
	await db.deleteFrom('eval_answers').where('register_code', '=', registerCode).execute();
	await db.deleteFrom('eval_results').where('register_code', '=', registerCode).execute();
}

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.code;
	return { levels: userId ? await getLevels(locals.db, userId) : [], title: 'Estudiantes' };
};

export const actions: Actions = {
	upsert: async ({ request, locals }) => {
		const formData = await request.formData();
		const data = {
			name: formData.get('name') as string,
			last_name: formData.get('last_name') as string,
			phone: formData.get('phone') as string | null,
			email: formData.get('email') as string,
			level_code: formData.get('level') as string,
			group_name: formData.get('group_name') as string,
			roll_code: formData.get('roll_code') as string
		};
		const existing_student_code = formData.get('code') as string | null;
		const user_code = locals.user?.code;

		if (!user_code) return fail(401, { error: 'Usuario no autenticado' });

		validateStudent(data);

		try {
			await locals.db.transaction().execute(async (trx) => {
				if (existing_student_code) {
					// Update student
					await trx
						.updateTable('students')
						.set({
							name: data.name,
							last_name: data.last_name,
							phone: data.phone,
							email: data.email,
							user_code
						})
						.where('code', '=', existing_student_code)
						.execute();

					// Check for existing register for this level
					const existingRegister = await trx
						.selectFrom('registers')
						.select(['code', 'group_name', 'level_code'])
						.where('student_code', '=', existing_student_code)
						.where('level_code', '=', data.level_code)
						.executeTakeFirst();

					if (existingRegister) {
						// Check for changes and delete evals if needed
						const isGroupChanging = existingRegister.group_name !== data.group_name;
						if (isGroupChanging) await deleteEvals(trx, existingRegister.code);

						// Update register
						await trx
							.updateTable('registers')
							.set({
								group_name: data.group_name,
								level_code: data.level_code,
								roll_code: data.roll_code
							})
							.where('code', '=', existingRegister.code)
							.execute();
					} else {
						// Create new register
						await trx
							.insertInto('registers')
							.values({ ...data, student_code: existing_student_code, user_code })
							.execute();
					}
				} else {
					// Create new student and register
					const student = await trx
						.insertInto('students')
						.values({
							name: data.name,
							last_name: data.last_name,
							phone: data.phone,
							email: data.email,
							user_code
						})
						.returning('code')
						.executeTakeFirstOrThrow();

					await trx
						.insertInto('registers')
						.values({
							student_code: student.code,
							level_code: data.level_code,
							group_name: data.group_name,
							roll_code: data.roll_code,
							user_code
						})
						.execute();
				}
			});
			return { type: 'success' };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Error en upsert de estudiante/registro';
			return fail(400, { error: message });
		}
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const code = formData.get('code') as string;
		const data = {
			name: formData.get('name') as string,
			last_name: formData.get('last_name') as string,
			phone: formData.get('phone') as string | null,
			email: formData.get('email') as string,
			level_code: formData.get('level') as string,
			group_name: formData.get('group_name') as string,
			roll_code: formData.get('roll_code') as string
		};

		validateStudent(data);

		try {
			await locals.db.transaction().execute(async (trx) => {
				// Get latest register
				const currentRegister = await trx
					.selectFrom('registers')
					.select(['code', 'group_name', 'level_code'])
					.where('student_code', '=', code)
					.orderBy('created_at', 'desc')
					.executeTakeFirst();

				if (!currentRegister) throw new Error('No se encontró registro para el estudiante');

				// Check for changes and delete evals if needed
				const isGroupChanging = currentRegister.group_name !== data.group_name;
				const isLevelChanging = currentRegister.level_code !== data.level_code;
				if (isGroupChanging || isLevelChanging) await deleteEvals(trx, currentRegister.code);

				// Update student
				await trx
					.updateTable('students')
					.set({
						name: data.name,
						last_name: data.last_name,
						phone: data.phone,
						email: data.email
					})
					.where('code', '=', code)
					.execute();

				// Update only this register
				await trx
					.updateTable('registers')
					.set({
						level_code: data.level_code,
						group_name: data.group_name,
						roll_code: data.roll_code
					})
					.where('code', '=', currentRegister.code)
					.execute();
			});
			return { type: 'success' };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Error actualizando estudiante/registro';
			return fail(400, { error: message });
		}
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const code = formData.get('code') as string;
		const register_code = formData.get('register_code') as string;
		const mode = formData.get('mode') as 'all' | 'only_register';

		try {
			await locals.db.transaction().execute(async (trx) => {
				if (mode === 'all') {
					// Delete all evals and registers for student, then student
					const registerCodes = await trx
						.selectFrom('registers')
						.select('code')
						.where('student_code', '=', code)
						.execute()
						.then((rows) => rows.map((r) => r.code));

					if (registerCodes.length > 0) {
						await trx
							.deleteFrom('eval_answers')
							.where('register_code', 'in', registerCodes)
							.execute();
						await trx
							.deleteFrom('eval_results')
							.where('register_code', 'in', registerCodes)
							.execute();
						await trx.deleteFrom('registers').where('code', 'in', registerCodes).execute();
					}
					await trx.deleteFrom('students').where('code', '=', code).execute();
				} else {
					// Delete only this register and its evals
					await deleteEvals(trx, register_code);
					await trx.deleteFrom('registers').where('code', '=', register_code).execute();
				}
			});
			return { type: 'success' };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Error eliminando estudiante/registro';
			return fail(400, { error: message });
		}
	}
};
