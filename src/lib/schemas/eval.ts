// Simple validation helpers
const required = (value: unknown, field: string): void => {
	if (!value || (typeof value === 'string' && !value.trim())) {
		throw new Error(`${field} es requerido`);
	}
};

const minValue = (value: unknown, min: number, field: string): void => {
	if (typeof value !== 'number' || value < min) {
		throw new Error(`${field} debe ser mayor a ${min - 1}`);
	}
};

// Eval validation
export const validateEval = (data: {
	name: string;
	level_code: string;
	group_name: string;
	eval_date: string;
}): void => {
	required(data.name, 'Nombre del examen');
	required(data.level_code, 'Nivel');
	required(data.group_name, 'Grupo');
	required(data.eval_date, 'Fecha del examen');
};

// Eval section validation
export const validateEvalSection = (data: {
	course_code: string;
	order_in_eval: number;
	question_count: number;
}): void => {
	required(data.course_code, 'Curso');
	minValue(data.order_in_eval, 1, 'Orden');
	minValue(data.question_count, 1, 'Número de preguntas');
};
