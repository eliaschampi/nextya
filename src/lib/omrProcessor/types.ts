// omrProcessor/types.ts
import * as cv from '@u4/opencv4nodejs'; // Necesario si usas tipos de cv aquí, si no, puedes quitarlo

export type AnswerValue = 'A' | 'B' | 'C' | 'D' | 'E' | null | 'error_multiple';

export interface OmrSuccessResult {
	status: 'success';
	studentCode: string;
	answers: { [questionNumber: number]: AnswerValue };
	debug?: { warpedThresholdedImage?: string | null };
}

// Asegúrate de que todos los códigos de error estén aquí
export type OmrErrorCode =
	| 'DECODE_FAILED'
	| 'IMAGE_EMPTY'
	| 'PREPROCESSING_FAILED'
	| 'FIDUCIALS_NOT_FOUND'
	| 'FIDUCIALS_INVALID_COUNT'
	| 'FIDUCIAL_ORDERING_FAILED'
	| 'WARP_FAILED'
	| 'WARPED_IMAGE_EMPTY'
	| 'ROI_EXTRACTION_FAILED'
	| 'CODE_ROI_EMPTY'
	| 'ANSWERS_ROI_EMPTY'
	| 'BUBBLE_DETECTION_FAILED'
	| 'CODE_PROCESSING_FAILED'
	| 'ANSWER_PROCESSING_FAILED'
	| 'INVALID_PARAMS'
	| 'CALCULATION_ERROR'
	| 'UNEXPECTED_ERROR';

export interface OmrErrorResult {
	status: 'error';
	errorCode: OmrErrorCode;
	message: string;
	details?: unknown;
	debug?: { processedImage?: string | null };
}

export type OmrResult = OmrSuccessResult | OmrErrorResult;

// Podrías añadir tipos para puntos, etc., si quieres ser más explícito
export type Point = cv.Point2; // Ejemplo
