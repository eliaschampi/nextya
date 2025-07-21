export type EntityType =
	| 'levels'
	| 'courses'
	| 'students'
	| 'registers'
	| 'evals'
	| 'eval_sections'
	| 'eval_questions'
	| 'eval_answers'
	| 'eval_results';

export interface Entity {
	name: string;
	label: EntityType;
}

export const entities: readonly Entity[] = [
	{ name: 'Niveles', label: 'levels' },
	{ name: 'Cursos', label: 'courses' },
	{ name: 'Estudiantes', label: 'students' },
	{ name: 'Matriculas', label: 'registers' },
	{ name: 'Evaluaciones', label: 'evals' },
	{ name: 'Secciones', label: 'eval_sections' },
	{ name: 'Preguntas', label: 'eval_questions' },
	{ name: 'Respuestas', label: 'eval_answers' },
	{ name: 'Resultados', label: 'eval_results' }
];
