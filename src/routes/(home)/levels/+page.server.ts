// routes/levels/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('levels:load');
	const { data: levels, error } = await locals.supabase.from('levels').select('*');
	if (error) {
		console.error('Error al cargar niveles:', error);
		return { levels: [] };
	}
	return { levels, title: 'Niveles' };
};

export const actions: Actions = {
	// create level
	create: async ({ locals, request }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const userId = locals.session?.user.id;
		const { error } = await locals.supabase
			.from('levels')
			.insert({ name, description, user_code: userId });
		if (error) return fail(400, { error: error.message });
		return { success: true };
	},

	// update level
	update: async ({ locals, request }) => {
		const formData = await request.formData();
		const levelCode = formData.get('code') as string;
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;

		const { error } = await locals.supabase
			.from('levels')
			.update({ name, description })
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
