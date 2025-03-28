import { z } from 'zod';

export const evalSchema = z.object({
	name: z.string().min(1, { message: 'Nombre del examen es requerido' }),
	level_code: z.string().min(1, { message: 'Nivel es requerido' }),
	group_name: z.string().min(1, { message: 'Grupo es requerido' }),
	eval_date: z.string().min(1, { message: 'Fecha del examen es requerida' })
});

export const evalSectionSchema = z.object({
	course_code: z.string().min(1, { message: 'Curso es requerido' }),
	order_in_eval: z.number().int().min(1, { message: 'Orden debe ser mayor a 0' }),
	question_count: z.number().int().min(1, { message: 'Número de preguntas debe ser mayor a 0' })
});

export type EvalSchema = z.infer<typeof evalSchema>;
export type EvalSectionSchema = z.infer<typeof evalSectionSchema>;
