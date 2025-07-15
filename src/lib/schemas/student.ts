// Custom validation system - simple and clean
export interface ValidationError {
	message: string;
	path: string;
}

export type ValidationResult<T> =
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			error: {
				message: string;
				errors: ValidationError[];
				format: () => Record<string, { _errors: string[] }>;
			};
	  };

// Student data type
export interface StudentSchema {
	name: string;
	last_name: string;
	phone?: string | null;
	email: string;
	level_code: string;
	group_name: string;
	roll_code: string;
}

// Simple validation helpers
const isRequired = (value: unknown, fieldName: string): ValidationError | null => {
	if (!value || (typeof value === 'string' && value.trim().length === 0)) {
		return {
			message: `${fieldName} es requerido`,
			path: fieldName.toLowerCase().replace(' ', '_')
		};
	}
	return null;
};

const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

const isValidRollCode = (rollCode: string): boolean => {
	const rollCodeRegex = /^\d{4}$/;
	return rollCodeRegex.test(rollCode);
};

// Student validation function
export const validateStudent = (data: unknown): ValidationResult<StudentSchema> => {
	const errors: ValidationError[] = [];

	if (!data || typeof data !== 'object') {
		return {
			success: false,
			error: {
				message: 'Datos inválidos',
				errors: [{ message: 'Datos inválidos', path: 'root' }],
				format: () => ({ root: { _errors: ['Datos inválidos'] } })
			}
		};
	}

	const input = data as Record<string, unknown>;

	// Validate required fields
	const nameError = isRequired(input.name, 'Nombre');
	if (nameError) errors.push(nameError);

	const lastNameError = isRequired(input.last_name, 'Apellido');
	if (lastNameError) errors.push(lastNameError);

	const emailError = isRequired(input.email, 'Email');
	if (emailError) errors.push(emailError);
	else if (typeof input.email === 'string' && !isValidEmail(input.email)) {
		errors.push({ message: 'Email inválido', path: 'email' });
	}

	const levelError = isRequired(input.level_code, 'Nivel');
	if (levelError) errors.push(levelError);

	const groupError = isRequired(input.group_name, 'Grupo');
	if (groupError) errors.push(groupError);

	const rollCodeError = isRequired(input.roll_code, 'Código de matrícula');
	if (rollCodeError) errors.push(rollCodeError);
	else if (typeof input.roll_code === 'string' && !isValidRollCode(input.roll_code)) {
		errors.push({ message: 'Código de matrícula debe ser 4 dígitos numéricos', path: 'roll_code' });
	}

	if (errors.length > 0) {
		const firstError = errors[0];
		return {
			success: false,
			error: {
				message: firstError.message,
				errors,
				format: () => {
					const formatted: Record<string, { _errors: string[] }> = {};
					errors.forEach((err) => {
						if (!formatted[err.path]) {
							formatted[err.path] = { _errors: [] };
						}
						formatted[err.path]._errors.push(err.message);
					});
					return formatted;
				}
			}
		};
	}

	return {
		success: true,
		data: {
			name: input.name as string,
			last_name: input.last_name as string,
			phone: input.phone as string | null | undefined,
			email: input.email as string,
			level_code: input.level_code as string,
			group_name: input.group_name as string,
			roll_code: input.roll_code as string
		}
	};
};

// Compatibility function to match Zod's safeParse API
export const studentSchema = {
	safeParse: validateStudent
};
