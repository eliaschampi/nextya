// routes/courses/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { reorderCourse } from '$lib/data/courses';
import type { Courses } from '$lib/types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('courses:load');

	try {
		const courses = await locals.db
			.selectFrom('courses')
			.selectAll()
			.orderBy('order', 'asc')
			.execute();

		return { courses, title: 'Cursos' };
	} catch {
		return { courses: [], title: 'Cursos' };
	}
};

export const actions: Actions = {
	// create course
	create: async ({ locals, request }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const abr = (formData.get('abr') as string) || name.substring(0, 3).toUpperCase();
		const userId = locals.user?.code;
		// Make sure userId is available, otherwise return an error
		if (!userId) return fail(401, { error: 'User not authenticated' });

		try {
			// Get the highest order value to place the new course at the end
			const maxOrderResult = await locals.db
				.selectFrom('courses')
				.select('order')
				.orderBy('order', 'desc')
				.limit(1)
				.executeTakeFirst();

			const newOrder = maxOrderResult ? maxOrderResult.order + 1 : 0;

			await locals.db
				.insertInto('courses')
				.values({ name, abr, user_code: userId, order: newOrder })
				.execute();

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error creando curso';
			return fail(400, { error: message });
		}
	},

	// update course
	update: async ({ locals, request }) => {
		const formData = await request.formData();
		const courseCode = formData.get('code') as string;
		const name = formData.get('name') as string;

		try {
			await locals.db.updateTable('courses').set({ name }).where('code', '=', courseCode).execute();

			return { success: true };
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Error actualizando curso';
			return fail(400, { error: message });
		}
	},

	// delete course
	delete: async ({ locals, request }) => {
		const formData = await request.formData();
		const courseCode = formData.get('code') as string;

		try {
			await locals.db.deleteFrom('courses').where('code', '=', courseCode).execute();

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error eliminando curso';
			return fail(400, { error: message });
		}
	},

	// move course up or down
	reorder: async ({ locals, request }) => {
		const formData = await request.formData();
		const courseCode = formData.get('code') as string;
		const direction = formData.get('direction') as 'up' | 'down';

		if (!courseCode || !direction || (direction !== 'up' && direction !== 'down')) {
			return fail(400, { error: 'Parámetros inválidos' });
		}

		try {
			// Get all courses to determine the new order
			const courses = await locals.db
				.selectFrom('courses')
				.selectAll()
				.orderBy('order', 'asc')
				.execute();

			// Perform the reordering
			const success = await reorderCourse(courses, courseCode, direction);

			if (!success) {
				return fail(500, { error: 'Error organizando cursos' });
			}

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error organizando cursos';
			return fail(500, { error: message });
		}
	}
};
