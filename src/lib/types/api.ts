import type { AnswerValue, OmrErrorCode } from '$lib/omrProcessor';

/** Representa la respuesta del estudiante para una pregunta específica */
export interface StudentAnswer {
	question_code: string;
	student_answer: AnswerValue;
	order_in_eval: number;
	correct_key: string;
	score_percent: number;
	is_correct: boolean;
	is_blank: boolean;
	is_multiple: boolean;
	section_code: string;
}

/** Resultado del procesamiento exitoso de una hoja OMR */
export interface ApiOmrSuccessData {
	roll_code: string; // Código detectado o ingresado
	register_code: string; // Código UUID del registro del estudiante
	student: {
		name: string;
		last_name: string;
	} | null; // Información del estudiante (null si no se encontró)
	answers: StudentAnswer[]; // Array detallado de respuestas
	scores: {
		general: {
			correct_count: number;
			incorrect_count: number;
			blank_count: number;
			total_questions: number;
			score: number; // Nota vigesimal (0-20)
		};
		by_section: Record<
			string, // section_code
			{
				section_name: string; // Nombre del curso/sección
				correct_count: number;
				incorrect_count: number;
				blank_count: number;
				total_questions: number;
				score: number; // Nota vigesimal (0-20)
			}
		>;
	};
	omr_debug_image?: string | null; // Imagen base64 para depuración (opcional)
}

/** Representa un error en el procesamiento OMR o validación */
export interface ApiOmrErrorData {
	code: OmrErrorCode | 'VALIDATION_ERROR' | 'STUDENT_NOT_FOUND' | 'INTERNAL_ERROR';
	message: string; // Mensaje genérico para el usuario
	details?: unknown; // Detalles técnicos (solo para logs)
	roll_code?: string; // Código detectado, si aplica
	omr_debug_image?: string | null; // Imagen base64 para depuración (opcional)
}

/** Respuesta unificada de la API /api/omr */
export type ApiOmrResponse =
	| { success: true; data: ApiOmrSuccessData }
	| { success: false; error: ApiOmrErrorData };

/** Datos necesarios para guardar los resultados */
export interface ResultToSave extends ApiOmrSuccessData {
	eval_code: string;
}
