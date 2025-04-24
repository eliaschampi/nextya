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
		const { data: student, error: studentError } = await locals.supabase
			.from('students')
			.select('name, last_name')
			.eq('code', student_code)
			.single();

		if (studentError) {
			console.error('Error fetching student:', studentError);
			return json({ error: 'Estudiante no encontrado' }, { status: 404 });
		}

		// Get all registers for this student
		const { data: registers, error: registersError } = await locals.supabase
			.from('registers')
			.select('code, level_code, group_name, roll_code, levels(name)')
			.eq('student_code', student_code);

		if (registersError) {
			console.error('Error fetching registers:', registersError);
			return json({ error: 'Error al obtener registros' }, { status: 500 });
		}

		// Get all results for this student's registers
		const { data: rawResults, error: resultsError } = await locals.supabase
			.from('student_register_results')
			.select('*')
			.in(
				'register_code',
				registers.map((r) => r.code)
			)
			.order('eval_date', { ascending: false });

		if (resultsError) {
			console.error('Error fetching results:', resultsError);
			return json({ error: 'Error al obtener resultados' }, { status: 500 });
		}

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
			registers,
			results
		};

		return json(response);
	} catch (error) {
		console.error('Unexpected error:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
