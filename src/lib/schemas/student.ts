import { z } from 'zod';

export const studentSchema = z.object({
	name: z.string().min(1, { message: 'Nombre es requerido' }),
	last_name: z.string().min(1, { message: 'Apellido es requerido' }),
	phone: z.string().optional(),
	email: z.string().email({ message: 'Email inválido' }),
	level_code: z.string().min(1, { message: 'Nivel es requerido' }),
	group_name: z.string().min(1, { message: 'Grupo es requerido' }),
	roll_code: z
		.string()
		.regex(/^\d{4}$/, { message: 'Código de matrícula debe ser 4 dígitos numéricos' })
});

export type StudentSchema = z.infer<typeof studentSchema>;
