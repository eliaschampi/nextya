// src/omrProcessor.ts
import * as cv from '@u4/opencv4nodejs';
import { Buffer } from 'buffer';

// --- Interfaces de Resultado y Tipos ---

/** Posibles valores para una respuesta: 'a', 'b', 'c', 'd', 'e', null (sin marcar), o 'error_multiple'. */
export type AnswerValue = 'a' | 'b' | 'c' | 'd' | 'e' | null | 'error_multiple';

/** Resultado exitoso del procesamiento OMR. */
export interface OmrSuccessResult {
	status: 'success';
	/** Código de estudiante extraído (puede contener 'X' para dígitos ambiguos). */
	studentCode: string;
	/** Objeto con las respuestas indexadas por número de pregunta (base 0). */
	answers: {
		[questionIndex: number]: AnswerValue;
	};
	/** Datos opcionales de depuración (si enableDebug = true). */
	debug?: {
		/** Imagen binaria alineada (warpeada y umbralizada) en formato base64. */
		warpedThresholdedImage?: string | null;
	};
}

/** Códigos de error específicos para identificar la fase del fallo. */
export type OmrErrorCode =
	| 'DECODE_FAILED' // No se pudo decodificar el buffer de imagen.
	| 'IMAGE_EMPTY' // La imagen decodificada está vacía.
	| 'PREPROCESSING_FAILED' // Error durante la conversión a gris, blur, threshold o morfología.
	| 'FIDUCIALS_NOT_FOUND' // No se encontraron contornos candidatos a fiduciales.
	| 'FIDUCIALS_INVALID_COUNT' // Se encontraron candidatos, pero no exactamente 4.
	| 'FIDUCIAL_ORDERING_FAILED' // Error al intentar ordenar los 4 puntos fiduciales.
	| 'WARP_FAILED' // Error durante el cálculo o aplicación de la transformación perspectiva.
	| 'WARPED_IMAGE_EMPTY' // La imagen resultante del warp está vacía.
	| 'ROI_EXTRACTION_FAILED' // No se pudieron calcular o extraer las ROIs de código/respuestas.
	| 'CODE_ROI_EMPTY' // La ROI de código extraída está vacía.
	| 'ANSWERS_ROI_EMPTY' // La ROI de respuestas extraída está vacía.
	| 'BUBBLE_DETECTION_FAILED' // Fallo irrecuperable dentro de la lógica de detección de burbujas.
	| 'CODE_PROCESSING_FAILED' // Error general durante el bucle de procesamiento del código.
	| 'ANSWER_PROCESSING_FAILED' // Error general durante el bucle de procesamiento de respuestas.
	| 'INVALID_PARAMS' // Parámetros de entrada (ej: numberOfQuestions) inválidos.
	| 'UNEXPECTED_ERROR'; // Error no capturado específicamente en otras categorías.

/** Resultado de error del procesamiento OMR. */
export interface OmrErrorResult {
	status: 'error';
	/** Código que identifica el tipo de error. */
	errorCode: OmrErrorCode;
	/** Mensaje descriptivo del error. */
	message: string;
	/** Información adicional opcional para depuración. */
	details?: unknown;
	/** Datos opcionales de depuración (si enableDebug = true). */
	debug?: {
		/** Imagen en la etapa donde ocurrió el error (ej: pre-procesada) en base64. */
		processedImage?: string | null;
	};
}

/** Tipo unión para el resultado del procesamiento. */
export type OmrResult = OmrSuccessResult | OmrErrorResult;

// --- Constantes de Configuración y Procesamiento ---
// Estas constantes deben ajustarse basándose en pruebas con imágenes reales.

// Layout General (Basado en descripción de la hoja A5)
const MAX_QUESTIONS_LAYOUT = 80;
const NUM_ANSWER_OPTIONS = 5; // A, B, C, D, E
const ANSWER_OPTIONS = ['a', 'b', 'c', 'd', 'e'] as const;
const NUM_CODE_DIGITS = 4;
const CODE_OPTIONS_PER_DIGIT = 10; // 0-9
const ANSWER_COLUMNS_COUNT = 4; // 80 preguntas en 4 columnas
const QUESTIONS_PER_COLUMN = MAX_QUESTIONS_LAYOUT / ANSWER_COLUMNS_COUNT; // 20

// Preprocessing (Valores iniciales - AJUSTAR EMPÍRICAMENTE)
const GAUSSIAN_BLUR_KERNEL_SIZE = new cv.Size(5, 5); // Suavizado inicial
const ADAPTIVE_THRESH_BLOCK_SIZE = 31; // Tamaño del vecindario (impar). Probar 21, 31, etc.
const ADAPTIVE_THRESH_C = 2; // Constante a restar. Probar 5, 9, etc. Aumentar para oscurecer fondo/anillos.
const BINARY_THRESHOLD_TYPE = cv.THRESH_BINARY_INV; // Marcas (oscuras) -> Blancas (255)

// Morfología (Para limpiar ruido post-threshold)
const MORPH_OPEN_KERNEL_SIZE = new cv.Size(3, 3); // Elimina pequeños puntos blancos (ruido/anillos finos). Probar (2,2).

// Detección de Fiduciales
const EXPECTED_FIDUCIAL_COUNT = 4;
const FIDUCIAL_MIN_AREA_FACTOR = 0.0005; // Mínima área relativa al total
const FIDUCIAL_MAX_AREA_FACTOR = 0.05; // Máxima área relativa al total
const FIDUCIAL_APPROX_EPSILON_FACTOR = 0.03; // Precisión para approxPolyDP (factor de perímetro)
const FIDUCIAL_ASPECT_RATIO_TOLERANCE = 0.3; // Tolerancia para desviación de ratio 1.0 (cuadrado)

// Corrección de Perspectiva
const WARPED_IMAGE_WIDTH = 840; // Ancho fijo para la imagen alineada (pixeles)
const WARPED_IMAGE_HEIGHT = Math.round(WARPED_IMAGE_WIDTH * (297 / 210)); // Alto manteniendo proporción A4/A5 (~1188)

// Ratios de Layout (Coordenadas relativas en la imagen *warpeada*)
const CODE_ROI_Y_START_RATIO = 0.08;
const CODE_ROI_HEIGHT_RATIO = 0.12;
const CODE_ROI_WIDTH_RATIO = 0.6;
const CODE_ROI_X_START_RATIO = (1.0 - CODE_ROI_WIDTH_RATIO) / 2;

const ANSWERS_ROI_Y_START_RATIO = CODE_ROI_Y_START_RATIO + CODE_ROI_HEIGHT_RATIO + 0.04;
const ANSWERS_ROI_HEIGHT_RATIO = 0.72;
const ANSWERS_ROI_WIDTH_RATIO = 0.92;
const ANSWERS_ROI_X_START_RATIO = (1.0 - ANSWERS_ROI_WIDTH_RATIO) / 2;

// Análisis de Burbujas (Estrategia de Muestreo Central)
const BUBBLE_FILL_THRESHOLD_RATIO = 0.5;
const BUBBLE_SAMPLE_RADIUS_RATIO = 0.35;

// --- Clase de Error Personalizada ---
class OmrError extends Error {
	readonly code: OmrErrorCode;

	constructor(
		code: OmrErrorCode,
		message: string,
		public readonly details?: unknown
	) {
		super(message);
		this.code = code;
		this.name = 'OmrError';
		// Preservar la cadena de prototipos para instanceof
		Object.setPrototypeOf(this, OmrError.prototype);
	}
}

// --- Funciones Auxiliares ---

/** Calcula el centroide (centro geométrico) de un contorno. */
function getCentroid(contour: cv.Contour): cv.Point2 {
	const m = contour.moments();
	// Evitar división por cero si el área es 0
	const cx = m.m00 !== 0 ? m.m10 / m.m00 : contour.boundingRect().x;
	const cy = m.m00 !== 0 ? m.m01 / m.m00 : contour.boundingRect().y;
	return new cv.Point2(cx, cy);
}

/**
 * Ordena 4 puntos en el orden: Superior-Izquierda, Superior-Derecha, Inferior-Derecha, Inferior-Izquierda.
 */
function orderCornerPoints(points: cv.Point2[]): cv.Point2[] {
	if (points.length !== 4) {
		throw new OmrError(
			'FIDUCIAL_ORDERING_FAILED',
			`orderCornerPoints requiere exactamente 4 puntos, recibió ${points.length}`
		);
	}
	// Ordenar por suma (x+y): TL es mín, BR es máx
	const sortedBySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
	// Ordenar por diferencia (y-x): TR es mín, BL es máx
	const sortedByDiff = [...points].sort((a, b) => a.y - a.x - (b.y - b.x));

	// TL = Mínima suma; BR = Máxima suma
	// TR = Mínima diferencia; BL = Máxima diferencia
	return [sortedBySum[0], sortedByDiff[0], sortedBySum[3], sortedByDiff[3]];
}

/** Codifica un cv.Mat a una cadena base64 (formato PNG). */
function matToBase64(mat: cv.Mat | null): string | null {
	if (!mat || mat.empty) return null;
	try {
		const buffer = cv.imencode('.png', mat);
		return `data:image/png;base64,${buffer.toString('base64')}`;
	} catch (error) {
		console.error('Error encoding Mat to Base64:', error);
		return null;
	}
}

/** Intenta liberar de forma segura la memoria de un cv.Mat si es válido. */
function tryReleaseMat(mat: cv.Mat | null | undefined): void {
	if (mat && !mat.empty && typeof mat.release === 'function') {
		try {
			mat.release();
		} catch {
			// Ignorar errores durante la liberación
		}
	}
}

/** Centraliza la creación de un OmrErrorResult */
function createErrorResult(
	error: Error | OmrError | unknown,
	defaultCode: OmrErrorCode = 'UNEXPECTED_ERROR',
	defaultMessage: string = 'Error inesperado durante el procesamiento OMR',
	debugImage: string | null = null
): OmrErrorResult {
	// Determinar código y mensaje del error
	let errorCode: OmrErrorCode;
	let message: string;

	if (error instanceof OmrError) {
		errorCode = error.code;
		message = error.message;
	} else if (error instanceof Error) {
		errorCode = mapErrorMessageToCode(error.message) || defaultCode;
		message = error.message;
	} else {
		errorCode = defaultCode;
		message = typeof error === 'string' ? error : defaultMessage;
	}

	const result: OmrErrorResult = {
		status: 'error',
		errorCode,
		message: `OMR Error: ${message}`,
		details: error instanceof Error ? error.stack : error
	};

	if (debugImage) {
		result.debug = { processedImage: debugImage };
	}

	return result;
}

/** Mapea mensajes de error a códigos específicos */
function mapErrorMessageToCode(message: string): OmrErrorCode | null {
	const patterns: [RegExp, OmrErrorCode][] = [
		[/Preprocessing failed|conversion|blur|threshold|morfología/i, 'PREPROCESSING_FAILED'],
		[/fiducial.*found|square fiducials/i, 'FIDUCIALS_NOT_FOUND'],
		[/fiducial.*count|Expected 4/i, 'FIDUCIALS_INVALID_COUNT'],
		[/cornerPoints|ordenar|orden/i, 'FIDUCIAL_ORDERING_FAILED'],
		[/[Ww]arp failed|transformación|perspectiva/i, 'WARP_FAILED'],
		[/empty image|imagen vacía/i, 'WARPED_IMAGE_EMPTY'],
		[/ROI.*extraction|región/i, 'ROI_EXTRACTION_FAILED'],
		[/Code ROI|código.*vacía/i, 'CODE_ROI_EMPTY'],
		[/Answer ROI|respuestas.*vacía/i, 'ANSWERS_ROI_EMPTY'],
		[/bubble|burbuja|sample ROI|sample|muestreo/i, 'BUBBLE_DETECTION_FAILED'],
		[/Code processing|procesamiento.*código/i, 'CODE_PROCESSING_FAILED'],
		[/Answer processing|procesamiento.*respuestas/i, 'ANSWER_PROCESSING_FAILED'],
		[/invalid|params|parámetros/i, 'INVALID_PARAMS']
	];

	for (const [pattern, code] of patterns) {
		if (pattern.test(message)) return code;
	}

	return null;
}

// --- Funciones de Procesamiento Principales ---

/**
 * Preprocesa la imagen original para facilitar la detección.
 */
async function preprocessImage(inputMat: cv.Mat): Promise<cv.Mat> {
	const matsToRelease: cv.Mat[] = [];
	try {
		const grayMat = await inputMat.cvtColorAsync(cv.COLOR_BGR2GRAY);
		matsToRelease.push(grayMat);

		const blurredMat = await grayMat.gaussianBlurAsync(GAUSSIAN_BLUR_KERNEL_SIZE, 0);
		matsToRelease.push(blurredMat);

		const threshMat = await blurredMat.adaptiveThresholdAsync(
			255,
			cv.ADAPTIVE_THRESH_GAUSSIAN_C,
			BINARY_THRESHOLD_TYPE,
			ADAPTIVE_THRESH_BLOCK_SIZE,
			ADAPTIVE_THRESH_C
		);
		matsToRelease.push(threshMat);

		const openKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, MORPH_OPEN_KERNEL_SIZE);
		matsToRelease.push(openKernel);

		const openedMat = await threshMat.morphologyExAsync(openKernel, cv.MORPH_OPEN);

		// Eliminamos todo excepto el resultado final
		matsToRelease.forEach(tryReleaseMat);

		return openedMat;
	} catch (error) {
		// Liberamos todos los recursos en caso de error
		matsToRelease.forEach(tryReleaseMat);
		throw new OmrError(
			'PREPROCESSING_FAILED',
			`Error en el preprocesamiento: ${error instanceof Error ? error.message : 'causa desconocida'}`
		);
	}
}

/**
 * Encuentra los 4 marcadores fiduciales cuadrados en la imagen preprocesada y los ordena.
 */
async function findAndOrderFiducials(processedMat: cv.Mat): Promise<cv.Point2[]> {
	try {
		const contours = await processedMat.findContoursAsync(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
		const imageArea = processedMat.rows * processedMat.cols;
		const minArea = imageArea * FIDUCIAL_MIN_AREA_FACTOR;
		const maxArea = imageArea * FIDUCIAL_MAX_AREA_FACTOR;

		const potentialFiducials: cv.Contour[] = [];

		for (const c of contours) {
			const area = c.area;
			if (area < minArea || area > maxArea) continue;

			const peri = c.arcLength(true);
			const approx = c.approxPolyDP(peri * FIDUCIAL_APPROX_EPSILON_FACTOR, true);

			if (approx.length === EXPECTED_FIDUCIAL_COUNT) {
				const rect = c.boundingRect();
				const aspectRatio = rect.width / rect.height;
				if (Math.abs(1 - aspectRatio) <= FIDUCIAL_ASPECT_RATIO_TOLERANCE) {
					potentialFiducials.push(c);
				}
			}
		}

		if (potentialFiducials.length === 0) {
			throw new OmrError(
				'FIDUCIALS_NOT_FOUND',
				`No se encontraron marcadores. (Área: ${minArea.toFixed(0)}-${maxArea.toFixed(0)}px)`
			);
		}

		if (potentialFiducials.length !== EXPECTED_FIDUCIAL_COUNT) {
			throw new OmrError(
				'FIDUCIALS_INVALID_COUNT',
				`Se esperaban ${EXPECTED_FIDUCIAL_COUNT} marcadores, se encontraron ${potentialFiducials.length}.`
			);
		}

		const fiducialCentroids = potentialFiducials.map(getCentroid);
		return orderCornerPoints(fiducialCentroids);
	} catch (error) {
		// Propagar el error manteniendo el tipo OmrError si ya lo es
		if (error instanceof OmrError) {
			throw error;
		}

		// De lo contrario, crear un nuevo OmrError con código apropiado
		throw new OmrError(
			mapErrorMessageToCode(error instanceof Error ? error.message : String(error)) ||
				'FIDUCIALS_NOT_FOUND',
			`Error en detección de fiduciales: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Aplica la corrección de perspectiva a la imagen preprocesada usando los puntos fiduciales.
 */
async function warpImage(
	processedMat: cv.Mat,
	orderedFiducialPoints: cv.Point2[]
): Promise<cv.Mat> {
	let transformMatrix: cv.Mat | null = null;

	try {
		const srcPoints = orderedFiducialPoints;
		const dstPoints = [
			new cv.Point2(0, 0),
			new cv.Point2(WARPED_IMAGE_WIDTH - 1, 0),
			new cv.Point2(WARPED_IMAGE_WIDTH - 1, WARPED_IMAGE_HEIGHT - 1),
			new cv.Point2(0, WARPED_IMAGE_HEIGHT - 1)
		];

		transformMatrix = cv.getPerspectiveTransform(srcPoints, dstPoints);
		const warpedMat = await processedMat.warpPerspectiveAsync(
			transformMatrix,
			new cv.Size(WARPED_IMAGE_WIDTH, WARPED_IMAGE_HEIGHT),
			cv.INTER_LINEAR,
			cv.BORDER_CONSTANT,
			new cv.Vec3(0, 0, 0)
		);

		tryReleaseMat(transformMatrix);

		if (!warpedMat || warpedMat.empty) {
			throw new OmrError('WARPED_IMAGE_EMPTY', 'La imagen resultante del warp está vacía.');
		}

		return warpedMat;
	} catch (error) {
		tryReleaseMat(transformMatrix);

		if (error instanceof OmrError) {
			throw error;
		}

		throw new OmrError(
			'WARP_FAILED',
			`Error en la transformación de perspectiva: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Extrae las Regiones de Interés (ROIs) para el código y las respuestas de la imagen warpeada.
 */
function extractROIs(warpedMat: cv.Mat): { codeROI: cv.Mat; answersROI: cv.Mat } {
	try {
		const h = warpedMat.rows;
		const w = warpedMat.cols;

		// Calcular coordenadas absolutas desde los ratios relativos
		const codeRoiX = Math.round(w * CODE_ROI_X_START_RATIO);
		const codeRoiY = Math.round(h * CODE_ROI_Y_START_RATIO);
		const codeRoiW = Math.round(w * CODE_ROI_WIDTH_RATIO);
		const codeRoiH = Math.round(h * CODE_ROI_HEIGHT_RATIO);

		const ansRoiX = Math.round(w * ANSWERS_ROI_X_START_RATIO);
		const ansRoiY = Math.round(h * ANSWERS_ROI_Y_START_RATIO);
		const ansRoiW = Math.round(w * ANSWERS_ROI_WIDTH_RATIO);
		const ansRoiH = Math.round(h * ANSWERS_ROI_HEIGHT_RATIO);

		// Función auxiliar para validar dimensiones antes de extraer
		function validateDimensions(
			x: number,
			y: number,
			w: number,
			h: number,
			name: string,
			parentWidth: number,
			parentHeight: number
		): void {
			if (w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > parentWidth || y + h > parentHeight) {
				throw new OmrError(
					'ROI_EXTRACTION_FAILED',
					`Dimensiones inválidas para ROI ${name}: x=${x}, y=${y}, w=${w}, h=${h} dentro de ${parentWidth}x${parentHeight}`
				);
			}
		}

		// Validar dimensiones antes de crear ROIs
		validateDimensions(codeRoiX, codeRoiY, codeRoiW, codeRoiH, 'Code', w, h);
		validateDimensions(ansRoiX, ansRoiY, ansRoiW, ansRoiH, 'Answers', w, h);

		// Crear ROIs
		const codeRect = new cv.Rect(codeRoiX, codeRoiY, codeRoiW, codeRoiH);
		const codeROI = warpedMat.getRegion(codeRect);

		const answersRect = new cv.Rect(ansRoiX, ansRoiY, ansRoiW, ansRoiH);
		const answersROI = warpedMat.getRegion(answersRect);

		// Verificar que las ROIs no estén vacías
		if (codeROI.empty) {
			throw new OmrError('CODE_ROI_EMPTY', 'La ROI de código extraída está vacía.');
		}

		if (answersROI.empty) {
			throw new OmrError('ANSWERS_ROI_EMPTY', 'La ROI de respuestas extraída está vacía.');
		}

		return { codeROI, answersROI };
	} catch (error) {
		if (error instanceof OmrError) {
			throw error;
		}

		throw new OmrError(
			'ROI_EXTRACTION_FAILED',
			`Error al extraer regiones de interés: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Analiza el área central de una burbuja para determinar si está marcada.
 */
function isBubbleFilled_CenterSample(
	roi: cv.Mat,
	centerX: number,
	centerY: number,
	bubbleRadius: number
): boolean {
	try {
		const sampleRadius = bubbleRadius * BUBBLE_SAMPLE_RADIUS_RATIO;
		if (sampleRadius < 1) return false;

		const sampleSize = Math.round(sampleRadius * 2);
		const sampleX = Math.max(0, Math.min(Math.round(centerX - sampleRadius), roi.cols - 1));
		const sampleY = Math.max(0, Math.min(Math.round(centerY - sampleRadius), roi.rows - 1));

		const clampedW = Math.max(0, Math.min(sampleSize, roi.cols - sampleX));
		const clampedH = Math.max(0, Math.min(sampleSize, roi.rows - sampleY));

		if (clampedW <= 0 || clampedH <= 0) {
			return false;
		}

		const sampleRect = new cv.Rect(sampleX, sampleY, clampedW, clampedH);
		const sampleROI = roi.getRegion(sampleRect);

		if (sampleROI.empty) return false;

		const totalPixels = sampleROI.rows * sampleROI.cols;
		if (totalPixels === 0) return false;

		const filledPixels = sampleROI.countNonZero();
		const filledRatio = filledPixels / totalPixels;

		return filledRatio >= BUBBLE_FILL_THRESHOLD_RATIO;
	} catch (error) {
		throw new OmrError(
			'BUBBLE_DETECTION_FAILED',
			`Error al analizar burbuja en (${centerX.toFixed(1)}, ${centerY.toFixed(1)}): ${
				error instanceof Error ? error.message : String(error)
			}`
		);
	}
}

/**
 * Procesa el bloque de código de estudiante.
 */
function processCodeBlock(codeROI: cv.Mat): string {
	try {
		let studentCode = '';
		const digitCellHeight = codeROI.rows / NUM_CODE_DIGITS;
		const optionCellWidth = codeROI.cols / CODE_OPTIONS_PER_DIGIT;
		const codeBubbleRadius = Math.min(optionCellWidth, digitCellHeight) * 0.45;

		for (let row = 0; row < NUM_CODE_DIGITS; row++) {
			let detectedDigit = -1;
			let marksInRow = 0;
			const centerY = (row + 0.5) * digitCellHeight;

			for (let col = 0; col < CODE_OPTIONS_PER_DIGIT; col++) {
				const centerX = (col + 0.5) * optionCellWidth;

				if (isBubbleFilled_CenterSample(codeROI, centerX, centerY, codeBubbleRadius)) {
					marksInRow++;
					detectedDigit = col;
				}
			}

			studentCode += marksInRow === 1 ? detectedDigit.toString() : 'X';
		}

		return studentCode;
	} catch (error) {
		if (error instanceof OmrError) {
			throw error;
		}

		throw new OmrError(
			'CODE_PROCESSING_FAILED',
			`Error al procesar bloque de código: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Procesa el bloque de respuestas del examen.
 */
function processAnswersBlock(
	answersROI: cv.Mat,
	numQuestionsToProcess: number
): Record<number, AnswerValue> {
	try {
		const answers: Record<number, AnswerValue> = {};
		const questionCellHeight = answersROI.rows / QUESTIONS_PER_COLUMN;
		const answerBlockWidth = answersROI.cols / ANSWER_COLUMNS_COUNT;
		const optionCellWidth = answerBlockWidth / NUM_ANSWER_OPTIONS;
		const answerBubbleRadius = Math.min(optionCellWidth, questionCellHeight) * 0.45;

		for (let qIndex = 0; qIndex < numQuestionsToProcess; qIndex++) {
			const colBlockIndex = Math.floor(qIndex / QUESTIONS_PER_COLUMN);
			const rowIndexInBlock = qIndex % QUESTIONS_PER_COLUMN;

			const questionBaseX = colBlockIndex * answerBlockWidth;
			const questionCenterY = (rowIndexInBlock + 0.5) * questionCellHeight;

			let markedOptionIndex = -1;
			let marksInQuestion = 0;

			for (let optIndex = 0; optIndex < NUM_ANSWER_OPTIONS; optIndex++) {
				const optionCenterX = questionBaseX + (optIndex + 0.5) * optionCellWidth;

				if (
					isBubbleFilled_CenterSample(
						answersROI,
						optionCenterX,
						questionCenterY,
						answerBubbleRadius
					)
				) {
					marksInQuestion++;
					markedOptionIndex = optIndex;
				}
			}

			if (marksInQuestion === 0) {
				answers[qIndex] = null;
			} else if (marksInQuestion === 1) {
				answers[qIndex] = ANSWER_OPTIONS[markedOptionIndex];
			} else {
				answers[qIndex] = 'error_multiple';
			}
		}

		return answers;
	} catch (error) {
		if (error instanceof OmrError) {
			throw error;
		}

		throw new OmrError(
			'ANSWER_PROCESSING_FAILED',
			`Error al procesar bloque de respuestas: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

// --- Función Principal OMR ---

/**
 * Procesa una imagen de hoja de respuestas OMR para extraer código de estudiante y respuestas.
 */
export async function omrProcessor(
	imageBuffer: Buffer,
	numberOfQuestions: number,
	enableDebug: boolean = false
): Promise<OmrResult> {
	// Array para gestionar liberación de memoria
	const matsToRelease: (cv.Mat | null)[] = [];
	// Datos de depuración
	const debugData: { warpedThresholdedImage?: string | null } = {};
	// Referencias para depuración de errores
	let processedMatForDebug: cv.Mat | null = null;

	try {
		// 1. Validar parámetros
		if (
			typeof numberOfQuestions !== 'number' ||
			numberOfQuestions <= 0 ||
			numberOfQuestions > MAX_QUESTIONS_LAYOUT
		) {
			throw new OmrError(
				'INVALID_PARAMS',
				`Número de preguntas inválido: debe estar entre 1 y ${MAX_QUESTIONS_LAYOUT}.`
			);
		}

		const numQuestionsToProcess = Math.floor(numberOfQuestions);

		// --- 2. Decodificar Imagen ---
		let originalMat: cv.Mat | null = null;
		try {
			originalMat = await cv.imdecodeAsync(imageBuffer);

			if (!originalMat || originalMat.empty) {
				throw new OmrError('IMAGE_EMPTY', 'La imagen decodificada está vacía.');
			}
			matsToRelease.push(originalMat);
		} catch (error) {
			throw new OmrError(
				'DECODE_FAILED',
				`Error al decodificar la imagen: ${error instanceof Error ? error.message : String(error)}`
			);
		}

		// --- 3. Preprocesamiento ---
		// Esta es la imagen que se usará para encontrar fiduciales y warpear.
		const processedMat = await preprocessImage(originalMat);
		matsToRelease.push(processedMat);

		// Para depuración, guardaremos una referencia a la imagen procesada
		processedMatForDebug = processedMat;

		// --- 4. Detección de Fiduciales ---
		const orderedFiducialPoints = await findAndOrderFiducials(processedMat);

		// --- 5. Corrección de Perspectiva (Warping) ---
		// Warpeamos la imagen preprocesada (binaria) directamente.
		const warpedThreshMat = await warpImage(processedMat, orderedFiducialPoints);
		matsToRelease.push(warpedThreshMat);

		// Guardar imagen para depuración si está habilitado
		if (enableDebug) {
			debugData.warpedThresholdedImage = matToBase64(warpedThreshMat);
		}

		// --- 6. Extracción de ROIs (Código y Respuestas) ---
		// Extrae vistas (views) de warpedThreshMat, no necesitan liberación separada.
		const { codeROI, answersROI } = extractROIs(warpedThreshMat);

		// --- 7. Procesamiento del Código de Estudiante ---
		const studentCode = processCodeBlock(codeROI);

		// --- 8. Procesamiento de Respuestas ---
		const answers = processAnswersBlock(answersROI, numQuestionsToProcess);

		// --- 9. Ensamblar Resultado Exitoso ---
		const result: OmrSuccessResult = {
			status: 'success',
			studentCode,
			answers
		};

		// Agregar datos de depuración si están habilitados
		if (enableDebug && Object.keys(debugData).length > 0) {
			result.debug = debugData;
		}

		// Liberar toda la memoria antes de devolver el resultado
		matsToRelease.forEach(tryReleaseMat);
		return result;
	} catch (error) {
		// Liberar memoria antes de manejar el error
		matsToRelease.forEach(tryReleaseMat);

		// Crear imagen de depuración si está disponible y habilitada
		let debugImage: string | null = null;
		if (enableDebug && processedMatForDebug) {
			debugImage = matToBase64(processedMatForDebug);
		}

		// Devolver resultado de error estructurado
		return createErrorResult(
			error,
			'UNEXPECTED_ERROR',
			'Error general en procesamiento OMR',
			debugImage
		);
	}
}
