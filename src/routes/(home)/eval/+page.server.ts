import { getLevels } from '$lib/data/levels';
import { getCourses } from '$lib/data/courses';
import { hasEvalQuestions } from '$lib/data/question';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { evalSchema, evalSectionSchema } from '$lib/schemas/eval';
import type { FormSection } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.code;
	let levels = [];
	if (userId) {
		levels = await getLevels(userId);
	}
	const courses = await getCourses();
	return { levels, courses, title: 'Exámenes' };
};

async function insertSections(db: any, evalCode: string, sections: FormSection[]) {
	if (sections.length > 0) {
		const sectionsToInsert = sections.map((section: FormSection) => ({
			eval_code: evalCode,
			course_code: section.course_code,
			order_in_eval: section.order_in_eval,
			question_count: section.question_count
		}));
		try {
			await db.insertInto('eval_sections').values(sectionsToInsert).execute();
		} catch (error) {
			console.error('Error insertando secciones:', error);
			const message = error instanceof Error ? error.message : 'Error desconocido';
			return fail(400, { error: message });
		}
	}
	return null;
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const level_code = formData.get('level_code') as string;
		const group_name = formData.get('group_name') as string;
		const eval_date = formData.get('eval_date') as string;
		const user_code = locals.user?.code;
		const sections = JSON.parse((formData.get('sections') as string) || '[]');

		if (!user_code) return fail(401, { error: 'No autenticado' });

		// Validar datos del examen
		const parsedEval = evalSchema.safeParse({ name, level_code, group_name, eval_date });
		if (!parsedEval.success) {
			return fail(400, { error: parsedEval.error.message, errors: parsedEval.error.format() });
		}

		// Validar secciones
		if (!sections.length) {
			return fail(400, { error: 'Debe agregar al menos una sección al examen' });
		}

		const sectionErrors = sections
			.map((section: FormSection, index: number) => {
				const sectionResult = evalSectionSchema.safeParse({
					course_code: section.course_code,
					question_count: section.question_count,
					order_in_eval: section.order_in_eval
				});
				return sectionResult.success
					? null
					: `Sección ${index + 1}: ${sectionResult.error.message}`;
			})
			.filter((error: unknown): error is string => error !== null);
		if (sectionErrors.length > 0) {
			return fail(400, { error: 'Errores en las secciones', errors: sectionErrors });
		}

		const code = formData.get('code') as string | null;

		if (code) {
			// Actualizar examen existente
			try {
				await locals.db
					.updateTable('evals')
					.set({ name, level_code, group_name, eval_date })
					.where('code', '=', code)
					.execute();
			} catch (error) {
				console.error('Error actualizando examen:', error);
				const message = error instanceof Error ? error.message : 'Error desconocido';
				return fail(400, { error: message });
			}

			// Solo modificar secciones si no hay preguntas registradas
			const hasQuestions = await hasEvalQuestions(code);
			if (!hasQuestions) {
				// Eliminar secciones existentes
				try {
					await locals.db.deleteFrom('eval_sections').where('eval_code', '=', code).execute();
				} catch (error) {
					console.error('Error eliminando secciones:', error);
					const message = error instanceof Error ? error.message : 'Error desconocido';
					return fail(400, { error: message });
				}

				// Insertar nuevas secciones
				const insertError = await insertSections(locals.db, code, sections);
				if (insertError) return insertError;
			}
		} else {
			// Crear nuevo examen
			try {
				const evalData = await locals.db
					.insertInto('evals')
					.values({ name, level_code, group_name, eval_date, user_code })
					.returning('code')
					.executeTakeFirst();

				const evalCode = evalData?.code;
				if (!evalCode) return fail(500, { error: 'Fallo al crear el examen' });

				// Insertar secciones para el nuevo examen
				const insertError = await insertSections(locals.db, evalCode, sections);
				if (insertError) return insertError;

				// Incluir el código del examen creado en la respuesta
				return { success: true, type: 'success', eval_code: evalCode };
			} catch (error) {
				console.error('Error creando examen:', error);
				const message = error instanceof Error ? error.message : 'Error desconocido';
				return fail(400, { error: message });
			}
		}
		return { success: true, type: 'success' };
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const evalCode = formData.get('code') as string;

		try {
			await locals.db.deleteFrom('eval_sections').where('eval_code', '=', evalCode).execute();

			await locals.db.deleteFrom('evals').where('code', '=', evalCode).execute();

			return { success: true, type: 'success' };
		} catch (error) {
			console.error('Error eliminando examen:', error);
			const message = error instanceof Error ? error.message : 'Error desconocido';
			return fail(400, { error: message });
		}
	}
};
