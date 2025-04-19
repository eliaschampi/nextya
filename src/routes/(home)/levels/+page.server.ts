// routes/levels/+page.server.ts
import { getLevels } from '$lib/data/levels';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('levels:load');
	const levels = await getLevels(locals.supabase);
	return { levels, title: 'Niveles' };
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

		const { error } = await locals.supabase.from('levels').insert({ name, abr, users: [userId] });
		if (error) return fail(400, { error: error.message });
		return { success: true };
	},

	// update level
	update: async ({ locals, request }) => {
		const formData = await request.formData();
		const levelCode = formData.get('code') as string;
		const name = formData.get('name') as string;
		const abr = formData.get('abr') as string;

		const { error } = await locals.supabase
			.from('levels')
			.update({ name, abr })
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
