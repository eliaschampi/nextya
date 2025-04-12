// omrProcessor/steps/04_extract_rois.ts
import * as cv from '@u4/opencv4nodejs';
import { OmrError } from '../error';
import {
	WARPED_IMAGE_WIDTH, // Necesario para calcular píxeles desde %
	WARPED_IMAGE_HEIGHT,
	CODE_ROI_X_PERCENT,
	CODE_ROI_Y_PERCENT,
	CODE_ROI_WIDTH_PERCENT,
	CODE_ROI_HEIGHT_PERCENT,
	ANSWERS_GLOBAL_Y_START_PERCENT,
	ANSWERS_MARGIN_LEFT_PERCENT,
	ANSWERS_MARGIN_RIGHT_PERCENT,
	QUESTIONS_PER_COLUMN,
	VERTICAL_PITCH_PERCENT,
	BUBBLE_HEIGHT_PERCENT
} from '../constants';

/**
 * Extrae las Regiones de Interés (ROI) para el código y las respuestas
 * desde la imagen warpeada y umbralizada, usando cálculos porcentuales.
 * @param warpedThreshMat Imagen warpeada y umbralizada.
 * @returns Objeto { codeROI: cv.Mat, answersROI: cv.Mat } (son vistas, no copias).
 */
export function extractROIs(warpedThreshMat: cv.Mat): { codeROI: cv.Mat; answersROI: cv.Mat } {
	if (!warpedThreshMat || !(warpedThreshMat instanceof cv.Mat) || warpedThreshMat.empty) {
		throw new OmrError(
			'WARPED_IMAGE_EMPTY',
			'Input matrix for ROI extraction is invalid or empty.'
		);
	}

	let codeROI: cv.Mat | null = null;
	let answersROI: cv.Mat | null = null;

	try {
		const h = warpedThreshMat.rows; // Alto real de la imagen warpeada
		const w = warpedThreshMat.cols; // Ancho real

		// Validar dimensiones base vs esperadas (opcional pero útil para debug)
		if (Math.abs(w - WARPED_IMAGE_WIDTH) > 2 || Math.abs(h - WARPED_IMAGE_HEIGHT) > 2) {
			console.warn(
				`Warped image dimensions (${w}x${h}) differ slightly from expected (${WARPED_IMAGE_WIDTH}x${WARPED_IMAGE_HEIGHT}). Calculations proceed with actual dimensions.`
			);
		}

		// --- Calcular Valores de Píxeles desde Porcentajes (usando dimensiones reales w, h) ---
		const codeRoiX = Math.round((w * CODE_ROI_X_PERCENT) / 100);
		const codeRoiY = Math.round((h * CODE_ROI_Y_PERCENT) / 100);
		const codeRoiW = Math.round((w * CODE_ROI_WIDTH_PERCENT) / 100);
		const codeRoiH = Math.round((h * CODE_ROI_HEIGHT_PERCENT) / 100);

		const answersStartY = Math.round((h * ANSWERS_GLOBAL_Y_START_PERCENT) / 100);
		const answersMarginLeft = Math.round((w * ANSWERS_MARGIN_LEFT_PERCENT) / 100);
		const answersMarginRight = Math.round((w * ANSWERS_MARGIN_RIGHT_PERCENT) / 100);

		const verticalPitchPx = Math.round((h * VERTICAL_PITCH_PERCENT) / 100);
		const bubbleHeightPx = Math.round((h * BUBBLE_HEIGHT_PERCENT) / 100);

		if (verticalPitchPx <= 0 || bubbleHeightPx <= 0) {
			throw new OmrError(
				'CALCULATION_ERROR',
				`Calculated vertical pitch (${verticalPitchPx}) or bubble height (${bubbleHeightPx}) is non-positive during ROI extraction.`
			);
		}

		// Calcular altura requerida para el ROI de respuestas en píxeles
		const requiredAnswersHeightPx = (QUESTIONS_PER_COLUMN - 1) * verticalPitchPx + bubbleHeightPx;

		// Calcular dimensiones finales del ROI de respuestas en píxeles
		const answersStartX = answersMarginLeft; // X siempre empieza en el margen izquierdo
		const answersWidthPx = w - answersMarginLeft - answersMarginRight;
		const answersHeightPx = requiredAnswersHeightPx;

		// --- Crear Rects con Clamping y Validación ---

		// Code ROI
		const clampedCodeX = Math.max(0, codeRoiX);
		const clampedCodeY = Math.max(0, codeRoiY);
		const clampedCodeW = Math.max(1, Math.min(codeRoiW, w - clampedCodeX)); // Asegura ancho >= 1 y dentro de límites
		const clampedCodeH = Math.max(1, Math.min(codeRoiH, h - clampedCodeY)); // Asegura alto >= 1 y dentro de límites

		if (clampedCodeW <= 1 || clampedCodeH <= 1) {
			throw new OmrError(
				'ROI_EXTRACTION_FAILED',
				`Code ROI calculated dimensions (${clampedCodeW}x${clampedCodeH}) are too small after clamping. Original Calc: (${codeRoiW}x${codeRoiH}) at (${codeRoiX},${codeRoiY})`
			);
		}
		const codeRect = new cv.Rect(clampedCodeX, clampedCodeY, clampedCodeW, clampedCodeH);

		// Answers ROI
		const clampedAnswersX = Math.max(0, answersStartX); // Ya debería ser >= 0
		const clampedAnswersY = Math.max(0, answersStartY);
		const clampedAnswersW = Math.max(1, Math.min(answersWidthPx, w - clampedAnswersX));
		const clampedAnswersH = Math.max(1, Math.min(answersHeightPx, h - clampedAnswersY));

		if (clampedAnswersW <= 1 || clampedAnswersH <= 1) {
			throw new OmrError(
				'ROI_EXTRACTION_FAILED',
				`Answers ROI calculated dimensions (${clampedAnswersW}x${clampedAnswersH}) are too small after clamping. Original Calc: (${answersWidthPx}x${answersHeightPx}) at (${clampedAnswersX},${clampedAnswersY})`
			);
		}
		const answersRect = new cv.Rect(
			clampedAnswersX,
			clampedAnswersY,
			clampedAnswersW,
			clampedAnswersH
		);

		// --- Extraer Regiones (Vistas) ---
		// getRegion devuelve una vista que comparte memoria, no necesita liberación separada.
		codeROI = warpedThreshMat.getRegion(codeRect);
		answersROI = warpedThreshMat.getRegion(answersRect);

		// --- Validar Vistas Extraídas ---
		if (!codeROI || codeROI.empty) {
			// Esto no debería ocurrir si el Rect es válido, pero es una buena verificación
			throw new OmrError(
				'CODE_ROI_EMPTY',
				'Extracted Code ROI view is empty despite valid Rect calculation.'
			);
		}
		if (!answersROI || answersROI.empty) {
			throw new OmrError(
				'ANSWERS_ROI_EMPTY',
				'Extracted Answers ROI view is empty despite valid Rect calculation.'
			);
		}

		return { codeROI, answersROI }; // Retornar las vistas
	} catch (error) {
		// Loggear detalles útiles para depurar problemas de ROI
		console.error(
			`Error details during ROI extraction: Image(${warpedThreshMat?.cols ?? 'N/A'}x${warpedThreshMat?.rows ?? 'N/A'})`,
			error instanceof Error ? error.message : error,
			error instanceof Error ? error.stack : null
		);
		// Re-lanzar como OmrError si no lo es ya
		if (error instanceof OmrError) throw error;
		throw new OmrError(
			'ROI_EXTRACTION_FAILED',
			`Unexpected error extracting ROIs: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}
