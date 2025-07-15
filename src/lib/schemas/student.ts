// Simple validation helpers
const required = (value: unknown, field: string): void => {
	if (!value || (typeof value === 'string' && !value.trim())) {
		throw new Error(`${field} es requerido`);
	}
};

const validEmail = (email: string, field: string): void => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		throw new Error(`${field} inválido`);
	}
};

const validRollCode = (rollCode: string, field: string): void => {
	const rollCodeRegex = /^\d{4}$/;
	if (!rollCodeRegex.test(rollCode)) {
		throw new Error(`${field} debe ser 4 dígitos numéricos`);
	}
};

// Student validation for form data (includes level_code)
export const validateStudent = (data: {
	name: string;
	last_name: string;
	phone?: string | null;
	email: string;
	level_code: string;
	group_name: string;
	roll_code: string;
}): void => {
	required(data.name, 'Nombre');
	required(data.last_name, 'Apellido');
	required(data.email, 'Email');
	validEmail(data.email, 'Email');
	required(data.level_code, 'Nivel');
	required(data.group_name, 'Grupo');
	required(data.roll_code, 'Código de matrícula');
	validRollCode(data.roll_code, 'Código de matrícula');
};

// Student validation for CSV data (no level_code, email can be null)
export const validateStudentRegister = (data: {
	name: string;
	last_name: string;
	phone?: string | null;
	email: string | null;
	group_name: string;
	roll_code: string;
}): void => {
	required(data.name, 'Nombre');
	required(data.last_name, 'Apellido');
	if (data.email) {
		validEmail(data.email, 'Email');
	}
	required(data.group_name, 'Grupo');
	required(data.roll_code, 'Código de matrícula');
	validRollCode(data.roll_code, 'Código de matrícula');
};
