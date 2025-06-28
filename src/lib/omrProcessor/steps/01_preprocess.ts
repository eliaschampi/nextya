// omrProcessor/steps/01_preprocess.ts
import * as cv from '@u4/opencv4nodejs';
import { OmrError } from '../error';
import { tryReleaseMat } from '../utils';
import {
	GAUSSIAN_BLUR_KERNEL_SIZE,
	ADAPTIVE_THRESH_BLOCK_SIZE,
	ADAPTIVE_THRESH_C,
	BINARY_THRESHOLD_TYPE,
	MORPH_OPEN_STRUCTURE_ELEMENT // Usar el elemento precalculado
} from '../constants';

/**
 * Preprocesa la imagen de entrada para análisis OMR (Gris, Blur, Threshold, MorphOpen).
 * @param inputMat Imagen original (color o gris).
 * @returns Imagen preprocesada (binarizada).
 */
export async function preprocessImage(inputMat: cv.Mat): Promise<cv.Mat> {
	if (!inputMat || !(inputMat instanceof cv.Mat) || inputMat.empty) {
		throw new OmrError('IMAGE_EMPTY', 'Input matrix for preprocessing is invalid or empty.');
	}

	const matsToRelease: cv.Mat[] = [];
	let currentMat = inputMat; // No añadir inputMat a release aquí

	try {
		// 1. Convertir a escala de grises si es necesario
		if (inputMat.channels > 1) {
			const grayMat = await currentMat.cvtColorAsync(cv.COLOR_BGR2GRAY);
			matsToRelease.push(grayMat); // Solo añadimos la nueva matriz creada
			currentMat = grayMat;
		}

		// 2. Desenfoque Gaussiano
		const blurredMat = await currentMat.gaussianBlurAsync(GAUSSIAN_BLUR_KERNEL_SIZE, 0);
		if (currentMat !== inputMat)
			matsToRelease.push(blurredMat); // Añadir si es nueva
		else matsToRelease.push(blurredMat); // Añadir si reemplaza la original (caso gris inicial)
		currentMat = blurredMat;

		// 3. Umbral Adaptativo Gaussiano (Invertido)
		const threshMat = await currentMat.adaptiveThresholdAsync(
			255,
			cv.ADAPTIVE_THRESH_GAUSSIAN_C,
			BINARY_THRESHOLD_TYPE, // Marcas -> Blanco (255), Fondo -> Negro (0)
			ADAPTIVE_THRESH_BLOCK_SIZE,
			ADAPTIVE_THRESH_C
		);
		matsToRelease.push(threshMat); // Siempre es una nueva matriz
		currentMat = threshMat;

		// 4. Operación Morfológica OPEN (Erode -> Dilate) para eliminar ruido
		// Usar el elemento estructural precalculado de constants.ts
		const openedMat = await currentMat.morphologyExAsync(
			MORPH_OPEN_STRUCTURE_ELEMENT,
			cv.MORPH_OPEN
		);
		// 'openedMat' es el resultado final de esta función, no la añadas a matsToRelease aquí.

		// Liberar matrices intermedias que no sean el resultado final
		matsToRelease.forEach((mat) => {
			if (mat !== openedMat) {
				// No liberar el resultado
				tryReleaseMat(mat);
			}
		});

		return openedMat; // Retornar la imagen procesada
	} catch (error) {
		// Asegurarse de liberar todas las matrices intermedias en caso de error
		matsToRelease.forEach(tryReleaseMat);
		// No intentar liberar currentMat si ya está en matsToRelease o es la entrada original
		// tryReleaseMat maneja esto implícitamente

		// Re-lanzar como OmrError
		throw new OmrError(
			'PREPROCESSING_FAILED',
			`Error during image preprocessing step: ${error instanceof Error ? error.message : String(error)}`,
			error // Keep original error details
		);
	}
}
