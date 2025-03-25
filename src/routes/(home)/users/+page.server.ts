// routes/users/+page.server.ts
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/supabaseAdmin';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ depends }) => {
	depends('users:load');
	const {
		data: { users },
		error
	} = await supabaseAdmin.auth.admin.listUsers();
	if (error) return { users: [] };
	return { users, title: 'Usuarios' };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;
		const password = formData.get('password') as string;

		const { error: authError } = await supabaseAdmin.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
			user_metadata: {
				name,
				last_name,
				photo_url: 'avatar.svg'
			}
		});
		if (authError) return fail(400, { error: authError.message });

		return { success: true };
	},

	update: async ({ request }) => {
		const formData = await request.formData();
		const userId = formData.get('user_id') as string;
		const email = formData.get('email') as string;
		const name = formData.get('name') as string;
		const last_name = formData.get('last_name') as string;

		const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
			email,
			user_metadata: {
				name,
				last_name
			}
		});
		if (updateError) return fail(400, { error: updateError.message });

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		const authUser = await locals.supabase.auth.getUser();

		const formData = await request.formData();
		const userId = formData.get('user_id') as string;
		if (authUser.data.user?.id === userId) {
			return fail(400, { error: 'No puedes eliminar a ti mismo' });
		}

		const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
		if (authError) return fail(400, { error: authError.message });

		return { success: true };
	}
};
