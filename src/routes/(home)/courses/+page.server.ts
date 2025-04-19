// routes/courses/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('courses:load');
	const { data: courses, error } = await locals.supabase.from('courses').select('*');
	if (error) {
		return { courses: [] };
	}
	return { courses, title: 'Cursos' };
};

export const actions: Actions = {
	// create course
	create: async ({ locals, request }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const abr = formData.get('abr') as string;
		const userId = locals.session?.user.id;
		// Make sure userId is available, otherwise return an error
		if (!userId) return fail(401, { error: 'User not authenticated' });

		const { error } = await locals.supabase
			.from('courses')
			.insert({ name, abr, user_code: userId });
		if (error) return fail(400, { error: error.message });
		return { success: true };
	},

	// update course
	update: async ({ locals, request }) => {
		const formData = await request.formData();
		const courseCode = formData.get('code') as string;
		const name = formData.get('name') as string;
		const abr = formData.get('abr') as string;

		const { error } = await locals.supabase
			.from('courses')
			.update({ name, abr })
			.eq('code', courseCode);
		if (error) return fail(400, { error: error.message });

		return { success: true };
	},

	// delete course
	delete: async ({ locals, request }) => {
		const formData = await request.formData();
		const courseCode = formData.get('code') as string;

		const { error } = await locals.supabase.from('courses').delete().eq('code', courseCode);
		if (error) return fail(400, { error: error.message });

		return { success: true };
	}
};
