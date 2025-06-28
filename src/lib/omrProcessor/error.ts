// omrProcessor/error.ts
import type { OmrErrorCode, OmrErrorResult } from './types';
import { matToBase64 } from './utils'; // Importar la función necesaria
import * as cv from '@u4/opencv4nodejs'; // Para el tipo cv.Mat si matToBase64 lo requiere

// --- Clase de Error Personalizada ---
export class OmrError extends Error {
	readonly code: OmrErrorCode;
	constructor(
		code: OmrErrorCode,
		message: string,
		public readonly details?: unknown
	) {
		super(message);
		this.code = code;
		this.name = 'OmrError';
		Object.setPrototypeOf(this, OmrError.prototype); // Para instanceof
	}
}

// --- Funciones de Ayuda para Errores ---

/** Mapea mensajes de error genéricos a OmrErrorCode específicos usando RegEx */
export function mapErrorMessageToCode(message: string): OmrErrorCode | null {
	const patterns: [RegExp, OmrErrorCode][] = [
		[/Preprocessing failed|conversion|blur|threshold|morphology/i, 'PREPROCESSING_FAILED'],
		[/fiducial.*found|square fiducials/i, 'FIDUCIALS_NOT_FOUND'],
		[/fiducial.*count|Expected \d/i, 'FIDUCIALS_INVALID_COUNT'],
		[/cornerPoints|ordenar|order|require \d points/i, 'FIDUCIAL_ORDERING_FAILED'],
		[/[Ww]arp failed|transformation|perspective/i, 'WARP_FAILED'],
		[/empty image|imagen vacía/i, 'WARPED_IMAGE_EMPTY'],
		[/ROI.*extraction|region|Invalid dimensions|clamping/i, 'ROI_EXTRACTION_FAILED'],
		[/Code ROI|código.*vacía/i, 'CODE_ROI_EMPTY'],
		[/Answer ROI|respuestas.*vacía/i, 'ANSWERS_ROI_EMPTY'],
		[/bubble|burbuja|sample ROI|sample|sampling|intensity|ratio|fill/i, 'BUBBLE_DETECTION_FAILED'],
		[/Code processing|procesamiento.*código/i, 'CODE_PROCESSING_FAILED'],
		[/Answer processing|procesamiento.*respuestas/i, 'ANSWER_PROCESSING_FAILED'],
		[/invalid|params|parámetros|Num preguntas inválido/i, 'INVALID_PARAMS'],
		[/decode failed|decoding/i, 'DECODE_FAILED'],
		[/calculation|percentage|dimension|coordinate/i, 'CALCULATION_ERROR']
		// Añadir más patrones si es necesario
	];
	for (const [pattern, code] of patterns) {
		if (pattern.test(message)) return code;
	}
	return null; // No match found
}

/** Crea un objeto OmrErrorResult estandarizado */
export function createErrorResult(
	error: Error | OmrError | unknown,
	defaultCode: OmrErrorCode = 'UNEXPECTED_ERROR',
	defaultMessage: string = 'Unexpected OMR processing error',
	debugImageMat: cv.Mat | null = null // Pasar el Mat directamente
): OmrErrorResult {
	let errorCode: OmrErrorCode;
	let message: string;
	let details: unknown = null;

	if (error instanceof OmrError) {
		errorCode = error.code;
		message = error.message;
		details = error.details ?? error.stack ?? null;
	} else if (error instanceof Error) {
		errorCode = mapErrorMessageToCode(error.message) || defaultCode;
		message = error.message;
		details = error.stack ?? null;
	} else {
		errorCode = defaultCode;
		message = typeof error === 'string' ? error : defaultMessage;
		details = error; // Preserve original error data if unknown type
	}

	const result: OmrErrorResult = {
		status: 'error',
		errorCode,
		message: `OMR Error (${errorCode}): ${message}`, // Mensaje más informativo
		details: details
	};

	// Convertir a Base64 solo si se proporciona un Mat de depuración
	if (debugImageMat) {
		result.debug = { processedImage: matToBase64(debugImageMat) };
	}

	// Loggear el error aquí centralizadamente podría ser útil
	console.error(`OMR Error Result Created: Code=${errorCode}, Message=${message}`, details);

	return result;
}
