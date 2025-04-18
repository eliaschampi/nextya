import type { SupabaseClient } from '@supabase/supabase-js';

export interface StudentRegisterInfo {
	register_code: string;
	roll_code: string;
	student: {
		name: string;
		last_name: string;
	} | null;
}

/**
 * Busca un registro de estudiante por su roll_code.
 */
export async function fetchRegisterByRollCode(
	supabase: SupabaseClient,
	rollCode: string
): Promise<StudentRegisterInfo | null> {
	if (!rollCode || !/^\d{4}$/.test(rollCode)) {
		return null; // Código inválido
	}

	const { data, error } = await supabase
		.from('registers')
		.select('code, roll_code, student_code, students:student_code (name, last_name)')
		.eq('roll_code', rollCode)
		.limit(1)
		.maybeSingle(); // Devuelve null si no se encuentra, en lugar de array vacío

	if (error) {
		console.error('Error fetching register by roll code:', error);
		return null;
	}

	if (!data) {
		return null; // No encontrado
	}

	// The Supabase query returns students as an array, but we need just the first item
	return {
		register_code: data.code,
		roll_code: data.roll_code,
		student: data.students as unknown as StudentRegisterInfo['student']
	};
}
