// Custom validation system for eval schemas
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

// Eval data types
export interface EvalSchema {
	name: string;
	level_code: string;
	group_name: string;
	eval_date: string;
}

export interface EvalSectionSchema {
	course_code: string;
	order_in_eval: number;
	question_count: number;
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

const isPositiveInteger = (value: unknown, fieldName: string): ValidationError | null => {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
		return {
			message: `${fieldName} debe ser mayor a 0`,
			path: fieldName.toLowerCase().replace(' ', '_')
		};
	}
	return null;
};

// Eval validation function
export const validateEval = (data: unknown): ValidationResult<EvalSchema> => {
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
	const nameError = isRequired(input.name, 'Nombre del examen');
	if (nameError) errors.push(nameError);

	const levelError = isRequired(input.level_code, 'Nivel');
	if (levelError) errors.push(levelError);

	const groupError = isRequired(input.group_name, 'Grupo');
	if (groupError) errors.push(groupError);

	const dateError = isRequired(input.eval_date, 'Fecha del examen');
	if (dateError) errors.push(dateError);

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
			level_code: input.level_code as string,
			group_name: input.group_name as string,
			eval_date: input.eval_date as string
		}
	};
};

// Eval section validation function
export const validateEvalSection = (data: unknown): ValidationResult<EvalSectionSchema> => {
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
	const courseError = isRequired(input.course_code, 'Curso');
	if (courseError) errors.push(courseError);

	const orderError = isPositiveInteger(input.order_in_eval, 'Orden');
	if (orderError) errors.push(orderError);

	const questionCountError = isPositiveInteger(input.question_count, 'Número de preguntas');
	if (questionCountError) errors.push(questionCountError);

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
			course_code: input.course_code as string,
			order_in_eval: input.order_in_eval as number,
			question_count: input.question_count as number
		}
	};
};

// Compatibility functions to match Zod's safeParse API
export const evalSchema = {
	safeParse: validateEval
};

export const evalSectionSchema = {
	safeParse: validateEvalSection
};
