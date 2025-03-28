import { getLevels } from '$lib/data/levels';
import { getCourses } from '$lib/data/courses';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { evalSchema } from '$lib/schemas/eval';

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

		// Check if we're updating an existing eval
		const existing_eval_code = formData.get('code') as string | null;

		if (existing_eval_code) {
			// Update eval data
			const { error: evalError } = await locals.supabase
				.from('evals')
				.update({ name, level_code, group_name, eval_date })
				.eq('code', existing_eval_code);

			if (evalError) return fail(400, { error: evalError.message });

			// Delete existing sections to recreate them
			const { error: deleteError } = await locals.supabase
				.from('eval_sections')
				.delete()
				.eq('eval_code', existing_eval_code);

			if (deleteError) return fail(400, { error: deleteError.message });

			// Create new sections
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

			return { type: 'success' };
		}

		// Create new eval
		const { data: eval_data, error: evalError } = await locals.supabase
			.from('evals')
			.insert({ name, level_code, group_name, eval_date, user_code })
			.select('code')
			.single();

		if (evalError || !eval_data) {
			return fail(400, { error: evalError?.message || 'Error creating exam' });
		}

		// Create sections
		if (sections.length > 0) {
			const sectionsToInsert = sections.map((section: Record<string, unknown>) => ({
				eval_code: eval_data.code,
				course_code: section.course_code as string,
				order_in_eval: Number(section.order_in_eval),
				question_count: Number(section.question_count)
			}));

			const { error: sectionsError } = await locals.supabase
				.from('eval_sections')
				.insert(sectionsToInsert);

			if (sectionsError) return fail(400, { error: sectionsError.message });
		}

		return { type: 'success' };
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const code = formData.get('code') as string;

		// Delete the eval (cascade will delete sections)
		const { error } = await locals.supabase.from('evals').delete().eq('code', code);

		if (error) return fail(400, { error: error.message });

		return { type: 'success' };
	}
};
