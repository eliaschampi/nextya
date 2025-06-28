import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { StudentResultsResponse, StudentResult } from '$lib/types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { student_code } = params;

	if (!student_code) {
		return json({ error: 'Código de estudiante no proporcionado' }, { status: 400 });
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

		// Get all results for this student's registers by joining tables
		const rawResults = await locals.db
			.selectFrom('eval_results')
			.innerJoin('registers', 'registers.code', 'eval_results.register_code')
			.innerJoin('evals', 'evals.code', 'eval_results.eval_code')
			.innerJoin('students', 'students.code', 'registers.student_code')
			.innerJoin('levels', 'levels.code', 'registers.level_code')
			.select([
				'eval_results.code as result_code',
				'eval_results.register_code',
				'eval_results.eval_code',
				'eval_results.correct_count',
				'eval_results.incorrect_count',
				'eval_results.blank_count',
				'eval_results.score',
				'eval_results.calculated_at',
				'evals.name as eval_name',
				'evals.eval_date',
				'registers.roll_code',
				'registers.group_name',
				'registers.level_code',
				'students.code as student_code',
				'students.name as student_name',
				'students.last_name as student_last_name',
				'levels.name as level_name',
				'eval_results.section_code'
			])
			.where(
				'eval_results.register_code',
				'in',
				registers.map((r) => r.code)
			)
			.orderBy('evals.eval_date', 'desc')
			.execute();

		// Transform results to ensure all required fields are non-null
		const results = rawResults.map((result) => {
			// Extract known fields with proper type handling
			const transformedResult: StudentResult = {
				result_code: String(result.result_code || ''),
				register_code: String(result.register_code || ''),
				eval_code: String(result.eval_code || ''),
				eval_name: String(result.eval_name || ''),
				eval_date: String(result.eval_date || ''),
				roll_code: String(result.roll_code || ''),
				correct_count: Number(result.correct_count || 0),
				incorrect_count: Number(result.incorrect_count || 0),
				blank_count: Number(result.blank_count || 0),
				score: Number(result.score || 0)
			};

			// Add optional fields if they exist with proper type casting
			if ('calculated_at' in result) {
				transformedResult.calculated_at = result.calculated_at as string | null;
			}
			if ('student_code' in result) {
				transformedResult.student_code = result.student_code as string | null;
			}
			if ('student_name' in result) {
				transformedResult.student_name = result.student_name as string | null;
			}
			if ('student_last_name' in result) {
				transformedResult.student_last_name = result.student_last_name as string | null;
			}
			if ('level_code' in result) {
				transformedResult.level_code = result.level_code as string | null;
			}
			if ('level_name' in result) {
				transformedResult.level_name = result.level_name as string | null;
			}
			if ('group_name' in result) {
				transformedResult.group_name = result.group_name as string | null;
			}
			if ('section_code' in result) {
				transformedResult.section_code = result.section_code as string | null;
			}

			return transformedResult;
		});

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
