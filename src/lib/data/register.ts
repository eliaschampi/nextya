import type { Database } from '$lib/database';

export interface StudentRegisterInfo {
	register_code: string;
	roll_code: string;
	student: {
		name: string;
		last_name: string;
	} | null;
}

export async function fetchRegisterByRollCode(
	db: Database,
	rollCode: string,
	groupName: string,
	evalLevelCode: string
): Promise<StudentRegisterInfo | null> {
	if (!rollCode || !/^\d{4}$/.test(rollCode)) {
		return null;
	}

	try {
		const data = await db
			.selectFrom('registers')
			.innerJoin('students', 'students.code', 'registers.student_code')
			.select([
				'registers.code',
				'registers.roll_code',
				'registers.group_name',
				'registers.student_code',
				'students.name',
				'students.last_name'
			])
			.where('registers.roll_code', '=', rollCode)
			.where('registers.group_name', '=', groupName)
			.where('registers.level_code', '=', evalLevelCode)
			.executeTakeFirst();

		if (!data) {
			return null; // No encontrado
		}

		return {
			register_code: data.code,
			roll_code: data.roll_code,
			student: {
				name: data.name,
				last_name: data.last_name
			}
		};
	} catch {
		return null;
	}
}
