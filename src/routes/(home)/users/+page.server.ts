// routes/users/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('users:load');
	const { data: users, error } = await locals.supabase.from('user_profiles').select('*');
	if (error) {
		console.error('Error al cargar usuarios:', error);
		return { users: [] };
	}
	return { users, title: 'Usuarios' };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const password = formData.get('password') as string;

		const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
			email,
			password,
			email_confirm: true
		});
		if (authError) return fail(400, { error: authError.message });

		const userId = authUser.user.id;
		const { error: profileError } = await supabaseAdmin
			.from('profiles')
			.insert({ code: userId, name, last_name });
		if (profileError) return fail(400, { error: profileError.message });

		return { success: true };
	},

	update: async ({ request, locals }) => {
		const formData = await request.formData();
		const userId = formData.get('user_id') as string;
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const email = formData.get('email') as string | null;

		const { error: profileError } = await locals.supabase
			.from('profiles')
			.update({ name, last_name })
			.eq('code', userId);
		if (profileError) return fail(400, { error: profileError.message });

		if (email) {
			const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email });
			if (authError) return fail(400, { error: authError.message });
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const authUser = await locals.supabase.auth.getUser();

		const formData = await request.formData();
		const userId = formData.get('user_id') as string;
		if (authUser.data.user?.id === userId) {
			return fail(400, { error: 'No puedes eliminar a ti mismo' });
		}

		const { error: profileError } = await supabaseAdmin
			.from('profiles')
			.delete()
			.eq('code', userId);
		if (profileError) return fail(400, { error: profileError.message });

		const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
		if (authError) return fail(400, { error: authError.message });

		return { success: true };
	}
};
