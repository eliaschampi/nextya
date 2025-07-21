// omrProcessor/steps/03_warp.ts
import * as cv from '@u4/opencv4nodejs';
import { OmrError } from '../error';
import { tryReleaseMat } from '../utils';
import { preprocessImage } from './01_preprocess'; // Necesita preprocesar después
import { WARPED_SIZE, WARP_BORDER_COLOR } from '../constants';
import type { Point } from '../types'; // Usar el tipo Point si se definió

/**
 * Aplica corrección de perspectiva a la imagen original usando los puntos fiduciales.
 * @param originalMat Imagen original (color o gris).
 * @param orderedFiducialPoints Array de 4 puntos fiduciales ordenados (TL, TR, BR, BL).
 * @returns Objeto con { warpedColor, warpedThresholded }
 */
export async function warpImage(
	originalMat: cv.Mat,
	orderedFiducialPoints: Point[] // Usar el tipo Point
): Promise<{ warpedColor: cv.Mat; warpedThresholded: cv.Mat }> {
	if (!originalMat || !(originalMat instanceof cv.Mat) || originalMat.empty) {
		throw new OmrError('IMAGE_EMPTY', 'Input matrix for warping is invalid or empty.');
	}
	if (!Array.isArray(orderedFiducialPoints) || orderedFiducialPoints.length !== 4) {
		throw new OmrError(
			'FIDUCIAL_ORDERING_FAILED',
			'Invalid ordered fiducial points provided for warping.'
		);
	}

	let transformMatrix: cv.Mat | null = null;
	let warpedColor: cv.Mat | null = null;
	let warpedThresholded: cv.Mat | null = null;

	try {
		// Puntos de origen (fiduciales detectados y ordenados)
		const srcPoints = orderedFiducialPoints;

		// Puntos de destino (esquinas de la imagen objetivo A5 warpeada)
		const [width, height] = [WARPED_SIZE.width, WARPED_SIZE.height];
		const dstPoints = [
			new cv.Point2(0, 0), // Top-Left
			new cv.Point2(width - 1, 0), // Top-Right
			new cv.Point2(width - 1, height - 1), // Bottom-Right
			new cv.Point2(0, height - 1) // Bottom-Left
		];

		// 1. Calcular la matriz de transformación perspectiva
		transformMatrix = cv.getPerspectiveTransform(srcPoints, dstPoints);

		// 2. Aplicar la transformación a la imagen *original* (color o gris)
		warpedColor = await originalMat.warpPerspectiveAsync(
			transformMatrix,
			WARPED_SIZE, // Tamaño de salida definido en constantes
			cv.INTER_LINEAR, // Interpolación lineal (buen compromiso calidad/velocidad)
			cv.BORDER_CONSTANT, // Rellenar bordes con un color constante
			WARP_BORDER_COLOR // Color de borde (blanco)
		);
		// Liberar la matriz de transformación tan pronto como sea posible
		tryReleaseMat(transformMatrix);
		transformMatrix = null; // Ayuda al GC

		if (!warpedColor || warpedColor.empty) {
			// La matriz original podría necesitar liberación si no se pasó a matsToRelease afuera
			throw new OmrError('WARPED_IMAGE_EMPTY', 'Warped image result (color/gray) is empty.');
		}

		// 3. Preprocesar la imagen *después* del warping
		// Esto a menudo da mejores resultados para el umbralizado que warpear una imagen ya umbralizada
		warpedThresholded = await preprocessImage(warpedColor); // Usa la función del paso 1

		if (!warpedThresholded || warpedThresholded.empty) {
			// warpedColor necesitará liberación si no se pasó a matsToRelease afuera
			tryReleaseMat(warpedColor);
			throw new OmrError('WARPED_IMAGE_EMPTY', 'Warped and thresholded image result is empty.');
		}

		// Retornar ambas imágenes (la de color/gris y la umbralizada)
		return { warpedColor, warpedThresholded };
	} catch (error) {
		// Asegurar liberación en caso de error
		tryReleaseMat(transformMatrix);
		tryReleaseMat(warpedColor);
		tryReleaseMat(warpedThresholded);

		if (error instanceof OmrError) throw error; // Re-lanzar si ya es OmrError

		// Envolver otros errores
		throw new OmrError(
			'WARP_FAILED',
			`Error during perspective warp or post-warp preprocessing: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}
