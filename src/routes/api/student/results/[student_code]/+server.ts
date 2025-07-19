import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { StudentResultsResponse, ResultItem } from '$lib/types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { student_code } = params;

	if (!student_code || !(await locals.can('results:read'))) {
		return json([]);
	}

	try {
		// Get student information first
		const student = await locals.db
			.selectFrom('students')
			.select(['name', 'last_name'])
			.where('code', '=', student_code)
			.executeTakeFirst();

		if (!student) {
			console.error('Student not found:', student_code);
			return json({ error: 'Estudiante no encontrado' }, { status: 404 });
		}

		// Get all registers for this student
		const registers = await locals.db
			.selectFrom('registers')
			.innerJoin('levels', 'levels.code', 'registers.level_code')
			.select([
				'registers.code',
				'registers.level_code',
				'registers.group_name',
				'registers.roll_code',
				'levels.name as level_name'
			])
			.where('registers.student_code', '=', student_code)
			.execute();

		if (!registers || registers.length === 0) {
			console.error('No registers found for student:', student_code);
			return json({ error: 'No se encontraron registros para este estudiante' }, { status: 404 });
		}

		// Get all results for this student using the student_register_results view
		const rawResults = await locals.db
			.selectFrom('student_register_results')
			.selectAll()
			.where(
				'register_code',
				'in',
				registers.map((r) => r.code)
			)
			.orderBy('eval_date', 'desc')
			.execute();

		// Transform to match ResultItem interface (same approach as CSV processor)
		const results = rawResults.map((result) => ({
			...result,
			score: Number(result.score || 0),
			calculated_at: result.calculated_at?.toISOString() || '',
			eval_date: result.eval_date?.toISOString() || ''
		})) as ResultItem[];

		const response: StudentResultsResponse = {
			student: {
				code: student_code,
				name: student.name,
				last_name: student.last_name
			},
			registers: registers.map((register) => ({
				code: register.code,
				level_code: register.level_code,
				group_name: register.group_name,
				roll_code: register.roll_code,
				levels: {
					name: register.level_name
				}
			})),
			results
		};

		return json(response);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Error desconocido';
		return json({ error: message }, { status: 500 });
	}
};
