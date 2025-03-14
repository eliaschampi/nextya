import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('students:load');

	const { data: students, error } = await locals.supabase.from('students').select('*');
	if (error) {
		console.error('Error loading students:', error);
		return { students: [] };
	}

	return { students, title: 'Estudiantes' };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const phoneData = formData.get('phone');
		const phone = phoneData ? phoneData.toString() : null;
		const email = formData.get('email') as string;
		const user_code = locals.session?.user.id;

		const { error } = await locals.supabase.from('students').insert({
			name,
			last_name,
			phone,
			user_code,
			email
		});
		if (error) {
			return fail(400, { error: error.message });
		}

		return { type: 'success' };
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const code = formData.get('code') as string;
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const phone = formData.get('phone') as string | null;
		const email = formData.get('email') as string;
		const is_active = formData.get('is_active') === 'true';

		const { error } = await locals.supabase
			.from('students')
			.update({ name, last_name, phone, email, is_active })
			.eq('code', code);
		if (error) {
			return fail(400, { error: error.message });
		}

		return { type: 'success' };
	},

	delete: async ({ request, locals }) => {
		const formData = await request.formData();
		const code = formData.get('code') as string;

		const { error } = await locals.supabase.from('students').delete().eq('code', code);
		if (error) {
			return fail(400, { error: error.message });
		}

		return { type: 'success' };
	}
};
