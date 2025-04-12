// omrProcessor/omrProcessor.ts
import * as cv from '@u4/opencv4nodejs';
import { Buffer } from 'buffer';
import type { OmrResult, OmrSuccessResult, AnswerValue } from './types'; // Importar tipos locales
import { MAX_QUESTIONS_LAYOUT } from './constants'; // Importar constantes necesarias
import { OmrError, createErrorResult } from './error'; // Importar manejo de errores local
import { tryReleaseMat, matToBase64 } from './utils'; // Importar utilidades locales
import { preprocessImage } from './steps/01_preprocess';
import { findAndOrderFiducials } from './steps/02_fiducials';
import { warpImage } from './steps/03_warp';
import { extractROIs } from './steps/04_extract_rois';
import { processCodeBlock, processAnswersBlock } from './steps/05_process_bubbles';

/**
 * Función principal que procesa una imagen OMR.
 * Orquesta los diferentes pasos: decodificación, preprocesamiento, detección de fiduciales,
 * warping, extracción de ROIs y procesamiento de código/respuestas.
 *
 * @param imageBuffer Buffer con los datos de la imagen.
 * @param numberOfQuestions Número de preguntas a procesar en la hoja.
 * @param enableDebug Si es true, incluye imagen de depuración en resultados (éxito y error).
 * @returns Promise que resuelve a un OmrResult (OmrSuccessResult u OmrErrorResult).
 */
export async function omrProcessorInternal( // Renombrada a Internal para evitar conflicto con exportación final
	imageBuffer: Buffer,
	numberOfQuestions: number,
	enableDebug: boolean = false
): Promise<OmrResult> {
	// --- Gestión de Memoria ---
	const matsToRelease: (cv.Mat | null | undefined)[] = [];
	// Variables para mantener referencias a matrices importantes para debug y liberación
	let originalMat: cv.Mat | null = null;
	let processedForFiducials: cv.Mat | null = null;
	let warpedColorMat: cv.Mat | null = null;
	let warpedThreshMat: cv.Mat | null = null;
	let debugMatOnError: cv.Mat | null = null; // Mat para imagen de debug en caso de error

	try {
		// --- 1. Validación de Parámetros ---
		if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
			throw new OmrError('INVALID_PARAMS', 'Invalid image buffer provided.');
		}
		if (
			typeof numberOfQuestions !== 'number' ||
			!Number.isInteger(numberOfQuestions) ||
			numberOfQuestions <= 0 ||
			numberOfQuestions > MAX_QUESTIONS_LAYOUT
		) {
			throw new OmrError(
				'INVALID_PARAMS',
				`Invalid number of questions: ${numberOfQuestions}. Must be an integer between 1 and ${MAX_QUESTIONS_LAYOUT}.`
			);
		}
		const numQuestionsToProcess = numberOfQuestions; // Alias claro

		// --- 2. Decodificación de Imagen ---
		try {
			originalMat = await cv.imdecodeAsync(imageBuffer);
			if (!originalMat || originalMat.empty) {
				// No lanzar error aquí todavía, OmrError lo hará
				throw new Error('Decoded image is empty or invalid.'); // Error genérico para que OmrError lo capture
			}
			matsToRelease.push(originalMat);
			debugMatOnError = originalMat; // Primera imagen disponible para debug
		} catch (error) {
			// Envolver el error de decodificación
			throw new OmrError(
				'DECODE_FAILED',
				`Failed to decode image buffer: ${error instanceof Error ? error.message : String(error)}`,
				error
			);
		}

		// --- 3. Preprocesamiento (para Fiduciales) ---
		processedForFiducials = await preprocessImage(originalMat); // Lanza OmrError en caso de fallo
		matsToRelease.push(processedForFiducials);
		debugMatOnError = processedForFiducials; // Actualizar imagen de debug

		// --- 4. Encontrar y Ordenar Fiduciales ---
		const orderedFiducialPoints = await findAndOrderFiducials(processedForFiducials); // Lanza OmrError

		// --- 5. Corrección de Perspectiva (Warp) ---
		const warpResult = await warpImage(originalMat, orderedFiducialPoints); // Lanza OmrError
		warpedColorMat = warpResult.warpedColor;
		warpedThreshMat = warpResult.warpedThresholded;
		matsToRelease.push(warpedColorMat);
		matsToRelease.push(warpedThreshMat); // Asegurarse de liberar ambas
		debugMatOnError = warpedThreshMat; // La imagen más procesada es usualmente la mejor para debug

		// --- 6. Extracción de ROIs ---
		const rois = extractROIs(warpedThreshMat); // Lanza OmrError
		// Obtener vistas (no necesitan liberación separada si warpedThreshMat se libera)
		const codeROI_View = rois.codeROI;
		const answersROI_View = rois.answersROI;

		// --- 7. Procesamiento del Bloque de Código ---
		const studentCode = processCodeBlock(codeROI_View); // Lanza OmrError

		// --- 8. Procesamiento del Bloque de Respuestas ---
		const answers_0based = processAnswersBlock(answersROI_View, numQuestionsToProcess); // Lanza OmrError

		// --- 9. Mapeo de Índices de Respuesta a 1-based ---
		const answers: { [questionNumber: number]: AnswerValue } = {};
		for (const zeroIdxStr in answers_0based) {
			const zeroIdx = parseInt(zeroIdxStr, 10);
			// Validar que el índice procesado esté dentro del rango esperado
			if (!isNaN(zeroIdx) && zeroIdx >= 0 && zeroIdx < numQuestionsToProcess) {
				answers[zeroIdx + 1] = answers_0based[zeroIdx];
			} else {
				console.warn(
					`Processed answer index ${zeroIdxStr} is out of range (0-${numQuestionsToProcess - 1}). Skipping.`
				);
			}
		}
		// Opcional: Asegurar que todas las claves 1..N existen, incluso si son null/error
		for (let i = 1; i <= numQuestionsToProcess; i++) {
			if (!(i in answers)) {
				console.warn(
					`Question ${i} was requested but missing from final processed answers. Setting to null.`
				);
				answers[i] = null; // O 'error_multiple'
			}
		}

		// --- 10. Ensamblaje del Resultado Exitoso ---
		const result: OmrSuccessResult = {
			status: 'success',
			studentCode,
			answers: answers // 1-based index
		};
		if (enableDebug) {
			// Usar la warpedThresholded para el debug en éxito
			result.debug = { warpedThresholdedImage: matToBase64(warpedThreshMat) };
		}

		// --- 11. Limpieza Final (Éxito) ---
		matsToRelease.forEach(tryReleaseMat);
		// Ayudar al GC (opcional)
		originalMat = processedForFiducials = warpedColorMat = warpedThreshMat = debugMatOnError = null;

		return result; // Retornar resultado exitoso
	} catch (error) {
		// --- Manejo de Errores ---
		console.error('Error caught during OMR processing orchestration:', error); // Log general

		// Crear el resultado de error usando la utilidad centralizada
		// Pasamos el 'debugMatOnError' que se fue actualizando a la última etapa exitosa
		const errorResult = createErrorResult(
			error, // El error original capturado
			'UNEXPECTED_ERROR', // Código por defecto si no se puede mapear
			error instanceof Error ? error.message : 'Unexpected OMR processing error occurred',
			enableDebug ? debugMatOnError : null // Incluir imagen de debug solo si está habilitado
		);

		// --- Limpieza Final (Error) ---
		// Asegurarse de que todas las matrices se liberen incluso si hubo un error
		matsToRelease.forEach(tryReleaseMat);
		// Ayudar al GC (opcional)
		originalMat = processedForFiducials = warpedColorMat = warpedThreshMat = debugMatOnError = null;

		return errorResult; // Retornar resultado de error
	}
}
