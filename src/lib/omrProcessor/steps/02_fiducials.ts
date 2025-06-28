// omrProcessor/steps/02_fiducials.ts
import * as cv from '@u4/opencv4nodejs';
import { OmrError, mapErrorMessageToCode } from '../error';
import { getCentroid, orderCornerPoints } from '../utils';
import {
	EXPECTED_FIDUCIAL_COUNT,
	FIDUCIAL_MIN_AREA_FACTOR,
	FIDUCIAL_MAX_AREA_FACTOR,
	FIDUCIAL_APPROX_EPSILON_FACTOR,
	FIDUCIAL_ASPECT_RATIO_TOLERANCE
} from '../constants';
import type { Point } from '../types'; // Usar el tipo Point si se definió

/**
 * Encuentra y ordena los 4 marcadores fiduciales cuadrados en la imagen preprocesada.
 * @param processedMat Imagen preprocesada (binarizada).
 * @returns Array de 4 puntos (cv.Point2) ordenados: TL, TR, BR, BL.
 */
export async function findAndOrderFiducials(processedMat: cv.Mat): Promise<Point[]> {
	if (!processedMat || !(processedMat instanceof cv.Mat) || processedMat.empty) {
		throw new OmrError('IMAGE_EMPTY', 'Input matrix for fiducial detection is invalid or empty.');
	}

	let contours: cv.Contour[] | null = null;

	try {
		// 1. Encontrar contornos externos
		contours = await processedMat.findContoursAsync(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
		// Decide if contours need release based on library specifics. Often they are views.
		// If they need release, add them to contoursToRelease

		if (!contours || contours.length === 0) {
			throw new OmrError(
				'FIDUCIALS_NOT_FOUND',
				'No initial contours found in the processed image.'
			);
		}

		// 2. Filtrar contornos para encontrar candidatos a fiduciales
		const imageArea = processedMat.rows * processedMat.cols;
		const minArea = imageArea * FIDUCIAL_MIN_AREA_FACTOR;
		const maxArea = imageArea * FIDUCIAL_MAX_AREA_FACTOR;

		const potentialFiducials: { contour: cv.Contour; area: number; approx: cv.Point2[] }[] = [];

		for (const c of contours) {
			const area = c.area;
			// Filtrar por área
			if (area < minArea || area > maxArea) continue;

			// Aproximar contorno a un polígono
			const peri = c.arcLength(true); // True para contorno cerrado
			const approx = c.approxPolyDP(peri * FIDUCIAL_APPROX_EPSILON_FACTOR, true);

			// Filtrar por número de vértices (buscamos cuadrados -> 4 vértices)
			if (approx.length === EXPECTED_FIDUCIAL_COUNT) {
				const rect = c.boundingRect(); // Bounding rectangle
				// Avoid division by zero or invalid rects
				if (rect.width <= 0 || rect.height <= 0) continue;

				// Filtrar por relación de aspecto (cercano a 1 para cuadrados)
				const aspectRatio = rect.width / rect.height;
				if (Math.abs(1 - aspectRatio) <= FIDUCIAL_ASPECT_RATIO_TOLERANCE) {
					potentialFiducials.push({ contour: c, area, approx });
				}
			}
			// Release approx polygon points if necessary for the library version
			// tryReleaseMat(approx); ? Check docs
		}

		// 3. Validar el número de fiduciales encontrados
		if (potentialFiducials.length < EXPECTED_FIDUCIAL_COUNT) {
			throw new OmrError(
				'FIDUCIALS_NOT_FOUND',
				`Found only ${potentialFiducials.length} potential square fiducials (expected ${EXPECTED_FIDUCIAL_COUNT}). Check image quality, lighting, and thresholding parameters. Area range: ${minArea.toFixed(0)}-${maxArea.toFixed(0)}px. Contours found: ${contours.length}`
			);
		}

		// Si se encuentran más de los esperados, tomar los más grandes (o los de área más cercana a un valor esperado)
		if (potentialFiducials.length > EXPECTED_FIDUCIAL_COUNT) {
			console.warn(
				`Found ${potentialFiducials.length} potential fiducials, using the ${EXPECTED_FIDUCIAL_COUNT} largest ones.`
			);
			potentialFiducials.sort((a, b) => b.area - a.area); // Ordenar por área descendente
			potentialFiducials.splice(EXPECTED_FIDUCIAL_COUNT); // Mantener solo los N primeros
		}

		// 4. Obtener centroides y ordenar
		const fiducialCentroids = potentialFiducials.map((pf) => getCentroid(pf.contour));
		const orderedPoints = orderCornerPoints(fiducialCentroids); // Usa la función de utils

		return orderedPoints;
	} catch (error) {
		// Ensure contours are released if needed
		// contoursToRelease.forEach(tryReleaseContour);

		// Re-throw OmrError or wrap other errors
		if (error instanceof OmrError) throw error;

		const mappedCode = mapErrorMessageToCode(
			error instanceof Error ? error.message : String(error)
		);
		throw new OmrError(
			mappedCode || 'FIDUCIALS_NOT_FOUND', // Default code if mapping fails
			`Error finding/ordering fiducials: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	} finally {
		// Final cleanup for contours if necessary
		// contoursToRelease.forEach(tryReleaseContour);
	}
}
