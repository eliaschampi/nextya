// src/lib/types/studentExport.ts

/**
 * Represents a student evaluation report row from the database
 */
export interface StudentEvalReport {
	eval_name: string;
	eval_code: string;
	eval_date: string;
	general_score: number;
	register_code: string;
	result_code: string;
	course_scores: Record<string, number>;
}

/**
 * Represents a row in the Excel export for student evaluations
 */
export interface StudentExportRow {
	'Nombre Examen': string;
	Fecha: string;
	'Nota General': number;
	[key: string]: string | number; // Dynamic course columns
}

/**
 * Represents a detailed evaluation result row from the database
 */
export interface EvalDetailedResult {
	roll_code: string;
	name: string;
	last_name: string;
	group_name: string;
	general_score: number;
	course_scores: Record<string, number>;
}

/**
 * Represents a row in the Excel export for detailed evaluation results
 */
export interface EvalDetailedExportRow {
	Código: string;
	Nombre: string;
	Apellidos: string;
	Grupo: string;
	'Nota General': number;
	[key: string]: string | number; // Dynamic course columns
}
