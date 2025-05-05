// routes/courses/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { reorderCourse } from '$lib/data/courses';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('courses:load');
	const { data: courses, error } = await locals.supabase
		.from('courses')
		.select('*')
		.order('order', { ascending: true });

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
		const userId = locals.session?.user.id;
		// Make sure userId is available, otherwise return an error
		if (!userId) return fail(401, { error: 'User not authenticated' });

		// Get the highest order value to place the new course at the end
		const { data: maxOrderResult } = await locals.supabase
			.from('courses')
			.select('order')
			.order('order', { ascending: false })
			.limit(1);

		const newOrder = maxOrderResult && maxOrderResult.length > 0 ? maxOrderResult[0].order + 1 : 0;

		const { error } = await locals.supabase
			.from('courses')
			.insert({ name, user_code: userId, order: newOrder });
		if (error) return fail(400, { error: error.message });
		return { success: true };
	},

	// update course
	update: async ({ locals, request }) => {
		const formData = await request.formData();
		const courseCode = formData.get('code') as string;
		const name = formData.get('name') as string;

		const { error } = await locals.supabase.from('courses').update({ name }).eq('code', courseCode);
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
	},

	// move course up or down
	reorder: async ({ locals, request }) => {
		const formData = await request.formData();
		const courseCode = formData.get('code') as string;
		const direction = formData.get('direction') as 'up' | 'down';

		if (!courseCode || !direction || (direction !== 'up' && direction !== 'down')) {
			return fail(400, { error: 'Parámetros inválidos' });
		}

		// Get all courses to determine the new order
		const { data: courses, error: fetchError } = await locals.supabase
			.from('courses')
			.select('*')
			.order('order', { ascending: true });

		if (fetchError || !courses) {
			return fail(500, { error: 'Error al obtener cursos' });
		}

		// Perform the reordering
		const success = await reorderCourse(locals.supabase, courses, courseCode, direction);

		if (!success) {
			return fail(500, { error: 'Error al reordenar cursos' });
		}

		return { success: true };
	}
};
