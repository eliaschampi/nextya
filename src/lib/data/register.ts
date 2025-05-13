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
 * Busca un registro de estudiante por su roll_code y verifica que pertenezca al grupo especificado.
 */
export async function fetchRegisterByRollCode(
	supabase: SupabaseClient,
	rollCode: string,
	groupName: string,
	evalLevelCode: string
): Promise<StudentRegisterInfo | null> {
	if (!rollCode || !/^\d{4}$/.test(rollCode)) {
		return null; // Código inválido
	}

	const query = supabase
		.from('registers')
		.select('code, roll_code, group_name, student_code, students:student_code (name, last_name)')
		.eq('roll_code', rollCode)
		.eq('group_name', groupName)
		.eq('level_code', evalLevelCode);

	const { data, error } = await query.limit(1).maybeSingle(); // Devuelve null si no se encuentra, en lugar de array vacío

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
