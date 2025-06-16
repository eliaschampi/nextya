import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals, params }) => {
	const { level, group } = params;

	if (!level || !group) return new Response(JSON.stringify([]));

	const { data: students, error } = await locals.db
		.from('student_registers')
		.select('*')
		.eq('level_code', level)
		.eq('group_name', group);

	if (error) return new Response(JSON.stringify([]), { status: 500 });

	return new Response(JSON.stringify(students));
};
