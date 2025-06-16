import { db } from '$lib/database';

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
	rollCode: string,
	groupName: string,
	evalLevelCode: string
): Promise<StudentRegisterInfo | null> {
	if (!rollCode || !/^\d{4}$/.test(rollCode)) {
		return null; // Código inválido
	}

	try {
		const data = await db
			.selectFrom('registers')
			.innerJoin('students', 'students.code', 'registers.studentCode')
			.select([
				'registers.code',
				'registers.rollCode',
				'registers.groupName',
				'registers.studentCode',
				'students.name',
				'students.lastName'
			])
			.where('registers.rollCode', '=', rollCode)
			.where('registers.groupName', '=', groupName)
			.where('registers.levelCode', '=', evalLevelCode)
			.executeTakeFirst();

		if (!data) {
			return null; // No encontrado
		}

		return {
			register_code: data.code,
			roll_code: data.rollCode,
			student: {
				name: data.name,
				last_name: data.lastName
			}
		};
	} catch (error) {
		console.error('Error fetching register by roll code:', error);
		return null;
	}
}
