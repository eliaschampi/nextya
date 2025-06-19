import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals, params }) => {
	const { level, group } = params;

	if (!level || !group) return new Response(JSON.stringify([]));

	try {
		const students = await locals.db
			.selectFrom('students')
			.innerJoin('registers', 'registers.student_code', 'students.code')
			.select([
				'students.code',
				'students.name',
				'students.last_name',
				'students.email',
				'students.phone',
				'registers.roll_code',
				'registers.group_name',
				'registers.level_code'
			])
			.where('registers.level_code', '=', level)
			.where('registers.group_name', '=', group)
			.execute();

		return new Response(JSON.stringify(students));
	} catch {
		return new Response(JSON.stringify([]), { status: 500 });
	}
};
