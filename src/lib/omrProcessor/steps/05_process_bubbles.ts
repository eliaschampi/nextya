// omrProcessor/steps/05_process_bubbles.ts
import * as cv from '@u4/opencv4nodejs';
import { OmrError } from '../error';
import type { AnswerValue } from '../types'; // Importar tipos necesarios
import {
	WARPED_IMAGE_WIDTH, // Usados para calcular dimensiones de burbuja en px
	WARPED_IMAGE_HEIGHT,
	BUBBLE_WIDTH_PERCENT,
	BUBBLE_HEIGHT_PERCENT,
	HORIZONTAL_PITCH_PERCENT,
	VERTICAL_PITCH_PERCENT,
	ANSWERS_MARGIN_LEFT_PERCENT, // Necesario para calcular X relativo de grupos
	ANSWERS_GROUP_WIDTH_PERCENT,
	ANSWERS_INTER_GROUP_SPACING_PERCENT,
	BUBBLE_SAMPLE_AREA_RATIO,
	BUBBLE_FILL_THRESHOLD_RATIO,
	NUM_CODE_DIGITS,
	CODE_OPTIONS_PER_DIGIT,
	NUM_ANSWER_OPTIONS,
	ANSWER_OPTIONS,
	QUESTIONS_PER_COLUMN,
	ANSWER_COLUMNS_COUNT
} from '../constants';

/**
 * Verifica si una burbuja está rellena basado en la proporción de píxeles blancos
 * en un área de muestreo central dentro de la burbuja.
 * @param roi ROI que contiene la burbuja (Code o Answers).
 * @param centerX Coordenada X central de la burbuja (relativa al ROI).
 * @param centerY Coordenada Y central de la burbuja (relativa al ROI).
 * @param bubbleWidthPx Ancho de la burbuja en píxeles.
 * @param bubbleHeightPx Alto de la burbuja en píxeles.
 * @returns `true` si la burbuja se considera rellena, `false` en caso contrario o en error.
 */
function isBubbleFilled_Ratio(
	roi: cv.Mat,
	centerX: number,
	centerY: number,
	bubbleWidthPx: number,
	bubbleHeightPx: number
): boolean {
	// Validaciones básicas de entrada
	if (!roi || roi.empty || bubbleWidthPx <= 0 || bubbleHeightPx <= 0) {
		console.warn(
			`Invalid input to isBubbleFilled_Ratio: ROI empty=${roi?.empty}, Bubble(${bubbleWidthPx}x${bubbleHeightPx})`
		);
		return false;
	}

	let sampleROI: cv.Mat | null = null;
	try {
		// 1. Calcular dimensiones y posición del área de muestreo central
		const sampleWidth = Math.max(1, Math.round(bubbleWidthPx * BUBBLE_SAMPLE_AREA_RATIO));
		const sampleHeight = Math.max(1, Math.round(bubbleHeightPx * BUBBLE_SAMPLE_AREA_RATIO));
		const sampleX = Math.max(0, Math.round(centerX - sampleWidth / 2));
		const sampleY = Math.max(0, Math.round(centerY - sampleHeight / 2));

		// 2. Clamping de coordenadas y dimensiones para asegurar que estén dentro del ROI padre
		const roiW = roi.cols;
		const roiH = roi.rows;
		const clampedX = Math.min(sampleX, roiW - 1); // No empezar más allá del penúltimo píxel
		const clampedY = Math.min(sampleY, roiH - 1);
		const clampedW = Math.max(1, Math.min(sampleWidth, roiW - clampedX)); // Ancho no puede exceder límite derecho
		const clampedH = Math.max(1, Math.min(sampleHeight, roiH - clampedY)); // Alto no puede exceder límite inferior

		if (clampedW <= 0 || clampedH <= 0) {
			// Esto podría pasar si centerX/Y están muy cerca del borde del ROI principal
			console.warn(
				`Bubble sample area at relative center (${centerX.toFixed(1)}, ${centerY.toFixed(1)}) resulted in zero or negative size (${clampedW}x${clampedH}) after clamping within ROI (${roiW}x${roiH}).`
			);
			return false;
		}

		// 3. Extraer la región de muestreo (vista)
		const sampleRect = new cv.Rect(clampedX, clampedY, clampedW, clampedH);
		sampleROI = roi.getRegion(sampleRect); // getRegion maneja límites internos

		if (!sampleROI || sampleROI.empty) {
			// Podría ocurrir si Rect está mal calculado a pesar del clamping
			console.warn(
				`Bubble sample ROI extracted at rect (${clampedX},${clampedY},${clampedW}x${clampedH}) is empty.`
			);
			return false;
		}

		// 4. Calcular proporción de píxeles rellenos (blancos en imagen umbralizada invertida)
		const totalPixels = sampleROI.rows * sampleROI.cols; // Area = W * H
		if (totalPixels === 0) return false; // Evitar división por cero

		const filledPixels = sampleROI.countNonZero(); // Cuenta píxeles != 0 (blancos)
		const filledRatio = filledPixels / totalPixels;

		// 5. Comparar con el umbral
		return filledRatio >= BUBBLE_FILL_THRESHOLD_RATIO;
	} catch (e) {
		// Loggear error y retornar false para no detener todo el proceso
		console.error(
			`Error in isBubbleFilled_Ratio at relative center (${centerX.toFixed(1)}, ${centerY.toFixed(1)}) ` +
				`with bubble size (${bubbleWidthPx.toFixed(1)}x${bubbleHeightPx.toFixed(1)}):`,
			e
		);
		return false; // Tratar como no rellenada en caso de error
	}
	// No necesitamos liberar sampleROI porque es una vista de 'roi'
}

/**
 * Procesa el ROI del código del estudiante para extraer el código de 4 dígitos.
 * Usa cálculos de posición relativos basados en porcentajes.
 * @param codeROI Vista (cv.Mat) del ROI del código.
 * @returns String del código de estudiante (4 caracteres, 'X' para errores/no marcados).
 */
export function processCodeBlock(codeROI: cv.Mat): string {
	if (!codeROI || !(codeROI instanceof cv.Mat) || codeROI.empty) {
		throw new OmrError('CODE_ROI_EMPTY', 'Input code ROI for processing is invalid or empty.');
	}

	try {
		// Calcular dimensiones y pasos en píxeles necesarios DENTRO de esta función
		const bubbleWidthPx = Math.round((WARPED_IMAGE_WIDTH * BUBBLE_WIDTH_PERCENT) / 100);
		const bubbleHeightPx = Math.round((WARPED_IMAGE_HEIGHT * BUBBLE_HEIGHT_PERCENT) / 100);
		const horizontalPitchPx = Math.round((WARPED_IMAGE_WIDTH * HORIZONTAL_PITCH_PERCENT) / 100);
		const verticalPitchPx = Math.round((WARPED_IMAGE_HEIGHT * VERTICAL_PITCH_PERCENT) / 100);

		if (
			bubbleWidthPx <= 0 ||
			bubbleHeightPx <= 0 ||
			horizontalPitchPx <= 0 ||
			verticalPitchPx <= 0
		) {
			throw new OmrError(
				'CALCULATION_ERROR',
				`Code block calculated pixel dimensions are invalid: B(${bubbleWidthPx}x${bubbleHeightPx}), P(${horizontalPitchPx}x${verticalPitchPx})`
			);
		}

		// Calcular centro de la primera burbuja (0,0) relativo al codeROI
		const firstBubbleCenterX = bubbleWidthPx / 2;
		const firstBubbleCenterY = bubbleHeightPx / 2;

		let studentCode = '';
		for (let digitIndex = 0; digitIndex < NUM_CODE_DIGITS; digitIndex++) {
			// 0 a 3
			const currentDigitCenterY = firstBubbleCenterY + digitIndex * verticalPitchPx;
			let detectedOption = -1; // El dígito marcado (0-9)
			let marksInDigit = 0;

			for (let optionIndex = 0; optionIndex < CODE_OPTIONS_PER_DIGIT; optionIndex++) {
				// 0 a 9
				const currentOptionCenterX = firstBubbleCenterX + optionIndex * horizontalPitchPx;

				if (
					isBubbleFilled_Ratio(
						codeROI,
						currentOptionCenterX,
						currentDigitCenterY,
						bubbleWidthPx,
						bubbleHeightPx
					)
				) {
					marksInDigit++;
					detectedOption = optionIndex; // El índice de la opción es el dígito
				}
			}

			// Determinar el carácter para este dígito
			if (marksInDigit === 1) {
				studentCode += detectedOption.toString();
			} else {
				studentCode += 'X'; // Error: no marcado o múltiple marca
				if (marksInDigit > 1) {
					console.warn(
						`Code Block: Multiple marks (${marksInDigit}) detected in digit row ${digitIndex}.`
					);
				}
				// else { console.log(`Code Block: No mark detected in digit row ${digitIndex}.`); } // Opcional
			}
		}
		// Asegurar longitud (aunque el bucle debería garantizarlo)
		return studentCode.padEnd(NUM_CODE_DIGITS, 'X');
	} catch (error) {
		if (error instanceof OmrError) throw error; // Re-lanzar si ya es OmrError
		// Envolver otros errores
		throw new OmrError(
			'CODE_PROCESSING_FAILED',
			`Error processing student code block: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}

/**
 * Procesa el ROI de las respuestas para extraer las respuestas marcadas.
 * Usa cálculos de posición relativos basados en porcentajes.
 * @param answersROI Vista (cv.Mat) del ROI de las respuestas.
 * @param numQuestionsToProcess Número de preguntas a leer.
 * @returns Record con índice 0-based: { [questionIndex: number]: AnswerValue }.
 */
export function processAnswersBlock(
	answersROI: cv.Mat,
	numQuestionsToProcess: number
): Record<number, AnswerValue> {
	// Retorna índice 0-based
	if (!answersROI || !(answersROI instanceof cv.Mat) || answersROI.empty) {
		throw new OmrError(
			'ANSWERS_ROI_EMPTY',
			'Input answers ROI for processing is invalid or empty.'
		);
	}
	if (numQuestionsToProcess <= 0) {
		return {}; // No questions to process
	}

	try {
		// Calcular dimensiones y pasos en píxeles necesarios
		const bubbleWidthPx = Math.round((WARPED_IMAGE_WIDTH * BUBBLE_WIDTH_PERCENT) / 100);
		const bubbleHeightPx = Math.round((WARPED_IMAGE_HEIGHT * BUBBLE_HEIGHT_PERCENT) / 100);
		const horizontalPitchPx = Math.round((WARPED_IMAGE_WIDTH * HORIZONTAL_PITCH_PERCENT) / 100);
		const verticalPitchPx = Math.round((WARPED_IMAGE_HEIGHT * VERTICAL_PITCH_PERCENT) / 100);
		const answersMarginLeftPx = Math.round(
			(WARPED_IMAGE_WIDTH * ANSWERS_MARGIN_LEFT_PERCENT) / 100
		);
		const groupWidthPx = Math.round((WARPED_IMAGE_WIDTH * ANSWERS_GROUP_WIDTH_PERCENT) / 100);
		const interGroupSpacingPx = Math.round(
			(WARPED_IMAGE_WIDTH * ANSWERS_INTER_GROUP_SPACING_PERCENT) / 100
		);

		if (
			bubbleWidthPx <= 0 ||
			bubbleHeightPx <= 0 ||
			horizontalPitchPx <= 0 ||
			verticalPitchPx <= 0 ||
			answersMarginLeftPx < 0 ||
			groupWidthPx <= 0 ||
			interGroupSpacingPx < 0
		) {
			throw new OmrError(
				'CALCULATION_ERROR',
				`Answers block calculated pixel dimensions are invalid: B(${bubbleWidthPx}x${bubbleHeightPx}), P(${horizontalPitchPx}x${verticalPitchPx}), G(${groupWidthPx}, ${interGroupSpacingPx}), M(${answersMarginLeftPx})`
			);
		}

		// Calcular las coordenadas X absolutas del inicio de cada grupo en la imagen warpeada
		const answersGroupXStartsPx = Array.from({ length: ANSWER_COLUMNS_COUNT }).map(
			(_, i) => answersMarginLeftPx + i * (groupWidthPx + interGroupSpacingPx)
		);

		// Calcular centro Y de la primera fila relativo al answersROI
		const firstRowCenterY_relative = bubbleHeightPx / 2;

		const answers: Record<number, AnswerValue> = {}; // Índice 0-based

		for (let qIndex = 0; qIndex < numQuestionsToProcess; qIndex++) {
			const colBlockIndex = Math.floor(qIndex / QUESTIONS_PER_COLUMN); // Grupo/Columna (0-3)
			const rowIndexInBlock = qIndex % QUESTIONS_PER_COLUMN; // Fila dentro del grupo (0-19)

			// Validar índice de columna
			if (colBlockIndex >= ANSWER_COLUMNS_COUNT || colBlockIndex >= answersGroupXStartsPx.length) {
				console.error(
					`Invalid column block index ${colBlockIndex} calculated for question index ${qIndex}. Max index is ${ANSWER_COLUMNS_COUNT - 1}.`
				);
				answers[qIndex] = 'error_multiple'; // Marcar como error y continuar
				continue;
			}

			// Calcular centro Y de la fila actual relativo al inicio del answersROI
			const questionCenterY_relative = firstRowCenterY_relative + rowIndexInBlock * verticalPitchPx;

			// Obtener la coordenada X *absoluta* del inicio del grupo actual
			const groupStartX_absolute = answersGroupXStartsPx[colBlockIndex];
			// Calcular la coordenada X *relativa* del inicio del grupo DENTRO del answersROI
			// El answersROI empieza en answersMarginLeftPx en la imagen warpeada.
			const groupStartX_relative = groupStartX_absolute - answersMarginLeftPx;

			// Calcular centro X de la primera opción ('A') relativo al inicio del answersROI
			const optionA_CenterX_relative = groupStartX_relative + bubbleWidthPx / 2;

			let markedOptionIndex = -1; // Índice de la opción marcada (0=A, 1=B, ...)
			let marksInQuestion = 0;

			for (let optIndex = 0; optIndex < NUM_ANSWER_OPTIONS; optIndex++) {
				// A-E
				// Calcular centro X de la opción actual relativo al inicio del answersROI
				const optionCenterX_relative = optionA_CenterX_relative + optIndex * horizontalPitchPx;

				if (
					isBubbleFilled_Ratio(
						answersROI,
						optionCenterX_relative,
						questionCenterY_relative,
						bubbleWidthPx,
						bubbleHeightPx
					)
				) {
					marksInQuestion++;
					markedOptionIndex = optIndex;
				}
			}

			// Asignar resultado para la pregunta (índice 0-based)
			if (marksInQuestion === 0) {
				answers[qIndex] = null;
			} else if (marksInQuestion === 1) {
				answers[qIndex] = ANSWER_OPTIONS[markedOptionIndex];
			} else {
				answers[qIndex] = 'error_multiple';
				// console.warn(`Answers Block: Multiple marks (${marksInQuestion}) detected in question index ${qIndex} (1-based: ${qIndex + 1}).`);
			}
		}
		return answers; // Retorna objeto con índices 0-based
	} catch (error) {
		if (error instanceof OmrError) throw error;
		throw new OmrError(
			'ANSWER_PROCESSING_FAILED',
			`Error processing answers block: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}
