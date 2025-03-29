import { getLevels } from '$lib/data/levels';
import { getCourses } from '$lib/data/courses';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { evalSchema, evalSectionSchema } from '$lib/schemas/eval';
import type { FormSection } from '../../../app';
import type { SupabaseClient } from '@supabase/supabase-js';

export const load: PageServerLoad = async ({ locals }) => {
	const levels = await getLevels(locals.supabase);
	const courses = await getCourses(locals.supabase);
	return { levels, courses, title: 'Exámenes' };
};

async function insertSections(supabase: SupabaseClient, evalCode: string, sections: FormSection[]) {
	if (sections.length > 0) {
		const sectionsToInsert = sections.map((section: FormSection) => ({
			eval_code: evalCode,
			course_code: section.course_code,
			order_in_eval: section.order_in_eval,
			question_count: section.question_count
		}));
		const { error } = await supabase.from('eval_sections').insert(sectionsToInsert);
		if (error) {
			console.error('Error insertando secciones:', error);
			return fail(400, { error: error.message });
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
		const user_code = locals.session?.user.id;
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
			const { error: evalError } = await locals.supabase
				.from('evals')
				.update({ name, level_code, group_name, eval_date })
				.eq('code', code);
			if (evalError) {
				console.error('Error actualizando examen:', evalError);
				return fail(400, { error: evalError.message });
			}

			// Eliminar secciones existentes
			const { error: deleteError } = await locals.supabase
				.from('eval_sections')
				.delete()
				.eq('eval_code', code);
			if (deleteError) {
				console.error('Error eliminando secciones:', deleteError);
				return fail(400, { error: deleteError.message });
			}

			// Insertar nuevas secciones
			const insertError = await insertSections(locals.supabase, code, sections);
			if (insertError) return insertError;
		} else {
			// Crear nuevo examen
			const { error: evalError, data: evalData } = await locals.supabase
				.from('evals')
				.insert({ name, level_code, group_name, eval_date, user_code })
				.select('code')
				.single();
			if (evalError) {
				console.error('Error creando examen:', evalError);
				return fail(400, { error: evalError.message });
			}

			const evalCode = evalData?.code;
			if (!evalCode) return fail(500, { error: 'Fallo al crear el examen' });

			// Insertar secciones para el nuevo examen
			const insertError = await insertSections(locals.supabase, evalCode, sections);
			if (insertError) return insertError;

			// Incluir el código del examen creado en la respuesta
			return { success: true, type: 'success', eval_code: evalCode };
		}
		return { success: true, type: 'success' };
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const evalCode = formData.get('code') as string;

		const { error: sectionsError } = await locals.supabase
			.from('eval_sections')
			.delete()
			.eq('eval_code', evalCode);
		if (sectionsError) {
			console.error('Error eliminando secciones:', sectionsError);
			return fail(400, { error: sectionsError.message });
		}

		const { error: evalError } = await locals.supabase.from('evals').delete().eq('code', evalCode);
		if (evalError) {
			console.error('Error eliminando examen:', evalError);
			return fail(400, { error: evalError.message });
		}

		return { success: true, type: 'success' };
	}
};
