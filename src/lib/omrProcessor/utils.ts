// omrProcessor/utils.ts
import * as cv from '@u4/opencv4nodejs';
import { EXPECTED_FIDUCIAL_COUNT } from './constants'; // Constantes usadas aquí
import { OmrError } from './error'; // Tipos de error usados aquí

/** Libera de forma segura la memoria de un cv.Mat */
export function tryReleaseMat(mat: cv.Mat | null | undefined): void {
	// Check added for robustness against non-Mat objects during cleanup
	if (mat && mat instanceof cv.Mat && !mat.empty && typeof mat.release === 'function') {
		try {
			mat.release();
		} catch (e) {
			console.warn('Failed to release Mat:', e); // Log warning instead of ignoring silently
		}
	}
}

/** Convierte un cv.Mat a una cadena Base64 PNG Data URL */
export function matToBase64(mat: cv.Mat | null): string | null {
	if (!mat || !(mat instanceof cv.Mat) || mat.empty) return null; // Added instanceof check
	try {
		const buffer = cv.imencode('.png', mat);
		return `data:image/png;base64,${buffer.toString('base64')}`;
	} catch (error) {
		console.error('Error encoding Mat to Base64:', error);
		return null; // Retorna null en caso de error
	}
}

/** Calcula el centroide de un contorno */
export function getCentroid(contour: cv.Contour): cv.Point2 {
	if (!contour || !(contour instanceof cv.Contour)) {
		throw new OmrError('CALCULATION_ERROR', 'Invalid contour provided to getCentroid');
	}
	const m = contour.moments();
	// Handle division by zero for m00
	const cx =
		m.m00 !== 0 ? m.m10 / m.m00 : contour.boundingRect().x + contour.boundingRect().width / 2;
	const cy =
		m.m00 !== 0 ? m.m01 / m.m00 : contour.boundingRect().y + contour.boundingRect().height / 2;
	return new cv.Point2(cx, cy);
}

/**
 * Ordena los 4 puntos de esquina (fiduciales) en orden: TL, TR, BR, BL.
 * Usa heurística suma/diferencia y fallback por ángulo.
 */
export function orderCornerPoints(points: cv.Point2[]): cv.Point2[] {
	if (!Array.isArray(points) || points.length !== EXPECTED_FIDUCIAL_COUNT) {
		throw new OmrError(
			'FIDUCIAL_ORDERING_FAILED',
			`orderCornerPoints requires an array of ${EXPECTED_FIDUCIAL_COUNT} points, received ${points?.length ?? 'invalid input'}`
		);
	}

	// Verificar que sean puntos válidos
	if (
		!points.every(
			(p) =>
				typeof p === 'object' && p !== null && typeof p.x === 'number' && typeof p.y === 'number'
		)
	) {
		// Loguear qué estructura tienen los puntos si falla, para depuración
		console.error('Invalid point structure detected in orderCornerPoints:', JSON.stringify(points));
		throw new OmrError(
			'FIDUCIAL_ORDERING_FAILED',
			'Invalid points structure provided in the array. Expected objects with numeric x, y properties.'
		);
	}

	// Heurística Suma/Diferencia
	const sortedBySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
	const sortedByDiff = [...points].sort((a, b) => a.y - a.x - (b.y - b.x));

	const tl = sortedBySum[0]; // Top-Left: menor suma x+y
	const br = sortedBySum[EXPECTED_FIDUCIAL_COUNT - 1]; // Bottom-Right: mayor suma x+y
	const tr = sortedByDiff[0]; // Top-Right: menor diferencia y-x
	const bl = sortedByDiff[EXPECTED_FIDUCIAL_COUNT - 1]; // Bottom-Left: mayor diferencia y-x

	// Comprobar si la heurística funcionó (todos los puntos son únicos)
	const uniquePoints = new Set([tl, tr, br, bl]);
	if (uniquePoints.size === EXPECTED_FIDUCIAL_COUNT) {
		return [tl, tr, br, bl];
	}

	// Fallback: Ordenar por ángulo con respecto al centroide del polígono
	console.warn(
		'orderCornerPoints: Sum/difference heuristic failed to find unique corners. Using angle fallback.'
	);
	const center = points.reduce(
		(acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }),
		{ x: 0, y: 0 }
	);

	// Calcular ángulo para cada punto y ordenar
	return points.sort((a, b) => {
		const angleA = Math.atan2(a.y - center.y, a.x - center.x);
		const angleB = Math.atan2(b.y - center.y, b.x - center.x);
		// Ajustar para que empiece cerca de -PI (esquina superior izquierda)
		// return angleA - angleB; // Ordena anti-horario empezando desde la derecha
		// Un orden más consistente podría ser necesario dependiendo de la entrada exacta
		// Este orden anti-horario estándar suele ser suficiente si el warp lo maneja.
		return angleA - angleB;
	});
	// Nota: El fallback por ángulo podría no dar siempre TL, TR, BR, BL exactamente,
	// pero dará un orden consistente (ej. anti-horario) que getPerspectiveTransform puede usar.
	// La heurística es preferible si funciona.
}
