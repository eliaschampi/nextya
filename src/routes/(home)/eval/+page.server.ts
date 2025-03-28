import { getLevels } from '$lib/data/levels';
import { getCourses } from '$lib/data/courses';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { evalSchema, evalSectionSchema } from '$lib/schemas/eval';

export const load: PageServerLoad = async ({ locals }) => {
	const levels = await getLevels(locals.supabase);
	const courses = await getCourses(locals.supabase);
	return { levels, courses, title: 'Exámenes' };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const level_code = formData.get('level_code') as string;
		const group_name = formData.get('group_name') as string;
		const eval_date = formData.get('eval_date') as string;
		const user_code = locals.session?.user.id;
		const sections = JSON.parse((formData.get('sections') as string) || '[]');

		if (!user_code) return fail(401, { error: 'User not authenticated' });

		// Validate data with Zod schema
		const result = evalSchema.safeParse({
			name,
			level_code,
			group_name,
			eval_date
		});

		if (!result.success) {
			const firstError = result.error.errors[0];
			return fail(400, {
				error: firstError.message || 'Validation error',
				errors: result.error.format()
			});
		}

		// Validate sections
		if (!sections.length) {
			return fail(400, { error: 'Debe agregar al menos una sección al examen' });
		}

		const sectionsValidation = sections.map((section: Record<string, unknown>) => {
			const sectionResult = evalSectionSchema.safeParse({
				course_code: section.course_code,
				question_count: Number(section.question_count)
			});

			if (!sectionResult.success) {
				return sectionResult.error.errors[0].message;
			}

			return null;
		});

		const sectionErrors = sectionsValidation.filter(
			(error: string | null): error is string => error !== null
		);
		if (sectionErrors.length > 0) {
			return fail(400, { error: sectionErrors[0] });
		}

		const existing_eval_code = formData.get('code') as string | null;

		if (existing_eval_code) {
			// Update eval data
			const { error: evalError } = await locals.supabase
				.from('evals')
				.update({ name, level_code, group_name, eval_date })
				.eq('code', existing_eval_code);

			if (evalError) return fail(400, { error: evalError.message });

			// Delete existing sections
			const { error: deleteError } = await locals.supabase
				.from('eval_sections')
				.delete()
				.eq('eval_code', existing_eval_code);

			if (deleteError) return fail(400, { error: deleteError.message });

			// Insert new sections
			if (sections.length > 0) {
				const sectionsToInsert = sections.map((section: Record<string, unknown>) => ({
					eval_code: existing_eval_code,
					course_code: section.course_code as string,
					order_in_eval: Number(section.order_in_eval),
					question_count: Number(section.question_count)
				}));

				const { error: sectionsError } = await locals.supabase
					.from('eval_sections')
					.insert(sectionsToInsert);

				if (sectionsError) return fail(400, { error: sectionsError.message });
			}
		} else {
			// Create new eval
			const { error: evalError, data: evalData } = await locals.supabase
				.from('evals')
				.insert({ name, level_code, group_name, eval_date, user_code })
				.select('code');

			if (evalError) return fail(400, { error: evalError.message });

			const evalCode = evalData?.[0]?.code;
			if (!evalCode) return fail(500, { error: 'Failed to create exam' });

			// Insert sections
			if (sections.length > 0) {
				const sectionsToInsert = sections.map((section: Record<string, unknown>) => ({
					eval_code: evalCode,
					course_code: section.course_code as string,
					order_in_eval: Number(section.order_in_eval),
					question_count: Number(section.question_count)
				}));

				const { error: sectionsError } = await locals.supabase
					.from('eval_sections')
					.insert(sectionsToInsert);

				if (sectionsError) return fail(400, { error: sectionsError.message });
			}
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const evalCode = formData.get('code') as string;

		// Delete sections first
		const { error: sectionsError } = await locals.supabase
			.from('eval_sections')
			.delete()
			.eq('eval_code', evalCode);

		if (sectionsError) return fail(400, { error: sectionsError.message });

		// Delete eval
		const { error: evalError } = await locals.supabase.from('evals').delete().eq('code', evalCode);

		if (evalError) return fail(400, { error: evalError.message });

		return { success: true };
	}
};
