// routes/levels/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('levels:load');

	try {
		const levels = await locals.db.selectFrom('levels').selectAll().execute();
		return { levels, title: 'Niveles' };
	} catch {
		return { levels: [], title: 'Niveles' };
	}
};

export const actions: Actions = {
	// create level
	create: async ({ locals, request }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const abr = formData.get('abr') as string;
		// Make sure userId is available, otherwise return an error
		const userId = locals.user?.code;
		if (!userId) return fail(401, { error: 'User not authenticated' });

		// Get selected users from form data
		const selectedUsers = formData.getAll('selectedUsers') as string[];
		// Ensure current user is included in the users array
		const users = [...new Set([userId, ...selectedUsers])];

		try {
			await locals.db.insertInto('levels').values({ name, abr, users }).execute();
			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error creando nivel';
			return fail(400, { error: message });
		}
	},

	// update level
	update: async ({ locals, request }) => {
		const formData = await request.formData();
		const levelCode = formData.get('code') as string;
		const name = formData.get('name') as string;
		const abr = formData.get('abr') as string;

		// Get selected users from form data
		const selectedUsers = formData.getAll('selectedUsers') as string[];
		// Ensure current user is included in the users array if they're the one updating
		const userId = locals.user?.code;
		const users = userId ? [...new Set([userId, ...selectedUsers])] : selectedUsers;

		try {
			await locals.db
				.updateTable('levels')
				.set({ name, abr, users })
				.where('code', '=', levelCode)
				.execute();

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error actualizando nivel';
			return fail(400, { error: message });
		}
	},

	// delete level
	delete: async ({ locals, request }) => {
		const formData = await request.formData();
		const levelCode = formData.get('code') as string;

		try {
			await locals.db.deleteFrom('levels').where('code', '=', levelCode).execute();

			return { success: true };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error eliminando nivel';
			return fail(400, { error: message });
		}
	}
};
