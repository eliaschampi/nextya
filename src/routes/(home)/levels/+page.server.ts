// routes/levels/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('levels:load');
	const { data, error } = await locals.supabase.from('levels').select('*');
	return { levels: error ? [] : data, title: 'Niveles' };
};

export const actions: Actions = {
	// create level
	create: async ({ locals, request }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const abr = formData.get('abr') as string;
		// Make sure userId is available, otherwise return an error
		const userId = locals.session?.user.id;
		if (!userId) return fail(401, { error: 'User not authenticated' });

		// Get selected users from form data
		const selectedUsers = formData.getAll('selectedUsers') as string[];
		// Ensure current user is included in the users array
		const users = [...new Set([userId, ...selectedUsers])];

		const { error } = await locals.supabase.from('levels').insert({ name, abr, users });
		if (error) return fail(400, { error: error.message });
		return { success: true };
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
		const userId = locals.session?.user.id;
		const users = userId ? [...new Set([userId, ...selectedUsers])] : selectedUsers;

		const { error } = await locals.supabase
			.from('levels')
			.update({ name, abr, users })
			.eq('code', levelCode);
		if (error) return fail(400, { error: error.message });

		return { success: true };
	},

	// delete level
	delete: async ({ locals, request }) => {
		const formData = await request.formData();
		const levelCode = formData.get('code') as string;

		const { error } = await locals.supabase.from('levels').delete().eq('code', levelCode);
		if (error) return fail(400, { error: error.message });

		return { success: true };
	}
};
