// src/omrProcessor.ts (works)
import * as cv from '@u4/opencv4nodejs';
import { Buffer } from 'buffer';

// --- answert types
export type AnswerValue = 'a' | 'b' | 'c' | 'd' | 'e' | null | 'error_multiple';
export interface OmrSuccessResult {
	status: 'success';
	studentCode: string;
	answers: { [questionNumber: number]: AnswerValue };
	debug?: { warpedThresholdedImage?: string | null };
}

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
	| 'UNEXPECTED_ERROR';

export interface OmrErrorResult {
	status: 'error';
	errorCode: OmrErrorCode;
	message: string;
	details?: unknown;
	debug?: { processedImage?: string | null };
}
export type OmrResult = OmrSuccessResult | OmrErrorResult;

// --- Constantes de Layout OMR ---
const MAX_QUESTIONS_LAYOUT = 80;
const NUM_ANSWER_OPTIONS = 5;
const ANSWER_OPTIONS = ['a', 'b', 'c', 'd', 'e'] as const;
const NUM_CODE_DIGITS = 4;
const CODE_OPTIONS_PER_DIGIT = 10;
const ANSWER_COLUMNS_COUNT = 4;
const QUESTIONS_PER_COLUMN = MAX_QUESTIONS_LAYOUT / ANSWER_COLUMNS_COUNT; // 20

// --- Constantes de Preprocesamiento ---
const GAUSSIAN_BLUR_KERNEL_SIZE = new cv.Size(3, 3);
const ADAPTIVE_THRESH_BLOCK_SIZE = 55;
const ADAPTIVE_THRESH_C = 3;
const BINARY_THRESHOLD_TYPE = cv.THRESH_BINARY_INV; 
const MORPH_OPEN_KERNEL_SIZE = new cv.Size(2.5, 2.5); 

// --- Constantes de Fiduciales ---
const EXPECTED_FIDUCIAL_COUNT = 4;
const FIDUCIAL_MIN_AREA_FACTOR = 0.001;
const FIDUCIAL_MAX_AREA_FACTOR = 0.05;
const FIDUCIAL_APPROX_EPSILON_FACTOR = 0.04;
const FIDUCIAL_ASPECT_RATIO_TOLERANCE = 0.3;

// --- Constantes de Warp ---
const WARPED_IMAGE_WIDTH = 840;
const WARPED_IMAGE_HEIGHT = 1192;

// --- Constantes de ROIs ---
const CODE_ROI_X_PX = 232;
const CODE_ROI_Y_PX = 48; 
const CODE_ROI_WIDTH_PX = 342;
const CODE_ROI_HEIGHT_PX = 163;

// --- Constantes de Procesamiento de ROIs ---
const ANSWERS_MARGIN_LEFT_PX = 21.656; 
const ANSWERS_MARGIN_RIGHT_PX = 21.656;
const ANSWERS_GLOBAL_Y_START_PX = 262.7;

// Bubble Dimensions and Spacing (Fixed - From Context)
const CODE_BUBBLE_WIDTH_PX = 28.4;// px
const CODE_BUBBLE_HEIGHT_PX = 34.9; // px
const CODE_HORIZONTAL_SPACING_PX = 6.6; //px
const CODE_VERTICAL_SPACING_PX = 7.1; // px

// Bubble Dimensions for Answers Block
const ANSWERS_BUBBLE_WIDTH_PX = CODE_BUBBLE_WIDTH_PX; 
const ANSWERS_BUBBLE_HEIGHT_PX = CODE_BUBBLE_HEIGHT_PX; 
const ANSWERS_HORIZONTAL_SPACING_PX = CODE_HORIZONTAL_SPACING_PX; 
const ANSWERS_VERTICAL_SPACING_PX = CODE_VERTICAL_SPACING_PX; 

// Calculated Pitches (Center-to-Center distances)
const CODE_HORIZONTAL_PITCH_PX = CODE_BUBBLE_WIDTH_PX + CODE_HORIZONTAL_SPACING_PX;
const CODE_VERTICAL_PITCH_PX = CODE_BUBBLE_HEIGHT_PX + CODE_VERTICAL_SPACING_PX;
const ANSWERS_HORIZONTAL_PITCH_PX = ANSWERS_BUBBLE_WIDTH_PX + ANSWERS_HORIZONTAL_SPACING_PX; 
const ANSWERS_VERTICAL_PITCH_PX = ANSWERS_BUBBLE_HEIGHT_PX + ANSWERS_VERTICAL_SPACING_PX;

// or the warped image answers group column is 
const ANSWERS_GROUP_WIDTH_PX = 168;
const ANSWERS_INTER_GROUP_SPACING_PX = 41.2;

// X coordinate of the *start* of each answer group 
const ANSWERS_GROUP_X_STARTS_PX = [
	ANSWERS_MARGIN_LEFT_PX, // Group 1 (Q 1-20)
	ANSWERS_MARGIN_LEFT_PX + ANSWERS_GROUP_WIDTH_PX + ANSWERS_INTER_GROUP_SPACING_PX, // Group 2 (Q 21-40)
	ANSWERS_MARGIN_LEFT_PX + 2 * (ANSWERS_GROUP_WIDTH_PX + ANSWERS_INTER_GROUP_SPACING_PX), // Group 3 (Q 41-60)
	ANSWERS_MARGIN_LEFT_PX + 3 * (ANSWERS_GROUP_WIDTH_PX + ANSWERS_INTER_GROUP_SPACING_PX) // Group 4 (Q 61-80)
];

// Ratio of white pixels (mark) needed within the sample area to be considered 'filled'
const BUBBLE_FILL_THRESHOLD_RATIO = 0.5; // Adjust empirically if needed
const BUBBLE_SAMPLE_AREA_RATIO = 0.6; // 

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
		Object.setPrototypeOf(this, OmrError.prototype);
	}
}

// --- Funciones Auxiliares 
function getCentroid(contour: cv.Contour): cv.Point2 {
	const m = contour.moments();
	const cx =
		m.m00 !== 0 ? m.m10 / m.m00 : contour.boundingRect().x + contour.boundingRect().width / 2;
	const cy =
		m.m00 !== 0 ? m.m01 / m.m00 : contour.boundingRect().y + contour.boundingRect().height / 2;
	return new cv.Point2(cx, cy);
}

function orderCornerPoints(points: cv.Point2[]): cv.Point2[] {
	if (points.length !== EXPECTED_FIDUCIAL_COUNT) {
		throw new OmrError(
			'FIDUCIAL_ORDERING_FAILED',
			`orderCornerPoints requires ${EXPECTED_FIDUCIAL_COUNT} points, received ${points.length}`
		);
	}
	const sortedBySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
	const sortedByDiff = [...points].sort((a, b) => a.y - a.x - (b.y - b.x));
	const tl = sortedBySum[0];
	const br = sortedBySum[points.length - 1];
	const tr = sortedByDiff[0];
	const bl = sortedByDiff[points.length - 1];
	const uniquePoints = new Set([tl, tr, br, bl]);
	if (uniquePoints.size === EXPECTED_FIDUCIAL_COUNT) {
		return [tl, tr, br, bl];
	}
	console.warn('orderCornerPoints: Sum/difference heuristic failed. Using angle fallback.');
	const center = points.reduce(
		(acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }),
		{
			x: 0,
			y: 0
		}
	);
	return points.sort((a, b) => {
		const angleA = Math.atan2(a.y - center.y, a.x - center.x);
		const angleB = Math.atan2(b.y - center.y, b.x - center.x);
		return angleA - angleB;
	});
}

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

function tryReleaseMat(mat: cv.Mat | null | undefined): void {
	if (mat && !mat.empty && typeof mat.release === 'function') {
		try {
			mat.release();
		} catch {
			// Ignore release errors
		}
	}
}

// --- create Error Result ---
function createErrorResult (
	error: Error | OmrError | unknown,
	defaultCode: OmrErrorCode = 'UNEXPECTED_ERROR',
	defaultMessage: string = 'Unexpected OMR processing error',
	debugImage: string | null = null
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
		details = error;
	}
	const result: OmrErrorResult = {
		status: 'error',
		errorCode,
		message: `OMR Error (${errorCode}): ${message}`,
		details: details
	};
	if (debugImage) {
		result.debug = { processedImage: debugImage };
	}
	console.error(`OMR Error Result: Code=${errorCode}, Message=${message}`, details);
	return result;
}

// Map error messages to specific error codes
function mapErrorMessageToCode(message: string): OmrErrorCode | null {
	const patterns: [RegExp, OmrErrorCode][] = [
		[/Preprocessing failed|conversion|blur|threshold|morphology/i, 'PREPROCESSING_FAILED'],
		[/fiducial.*found|square fiducials/i, 'FIDUCIALS_NOT_FOUND'],
		[/fiducial.*count|Expected \d/i, 'FIDUCIALS_INVALID_COUNT'],
		[/cornerPoints|ordenar|order|require \d points/i, 'FIDUCIAL_ORDERING_FAILED'],
		[/[Ww]arp failed|transformation|perspective/i, 'WARP_FAILED'],
		[/empty image|imagen vacía/i, 'WARPED_IMAGE_EMPTY'],
		[/ROI.*extraction|region|Invalid dimensions/i, 'ROI_EXTRACTION_FAILED'],
		[/Code ROI|código.*vacía/i, 'CODE_ROI_EMPTY'],
		[/Answer ROI|respuestas.*vacía/i, 'ANSWERS_ROI_EMPTY'],
		[/bubble|burbuja|sample ROI|sample|sampling|intensity|ratio|fill/i, 'BUBBLE_DETECTION_FAILED'], // Updated regex
		[/Code processing|procesamiento.*código/i, 'CODE_PROCESSING_FAILED'],
		[/Answer processing|procesamiento.*respuestas/i, 'ANSWER_PROCESSING_FAILED'],
		[/invalid|params|parámetros|Num preguntas inválido/i, 'INVALID_PARAMS'],
		[/decode failed|decoding/i, 'DECODE_FAILED']
	];
	for (const [pattern, code] of patterns) {
		if (pattern.test(message)) return code;
	}
	return null;
}

// --- Funciones de Procesamiento (Core OMR Logic) ---
/** Preprocesses the input image for OMR analysis.*/
async function preprocessImage(inputMat: cv.Mat): Promise<cv.Mat> {
	const matsToRelease: cv.Mat[] = [];
	let currentMat = inputMat;
	try {
		if (inputMat.channels > 1) {
			const grayMat = await currentMat.cvtColorAsync(cv.COLOR_BGR2GRAY);
			matsToRelease.push(grayMat);
			currentMat = grayMat;
		}
		const blurredMat = await currentMat.gaussianBlurAsync(GAUSSIAN_BLUR_KERNEL_SIZE, 0);
		matsToRelease.push(blurredMat);
		currentMat = blurredMat;
		const threshMat = await currentMat.adaptiveThresholdAsync(
			255,
			cv.ADAPTIVE_THRESH_GAUSSIAN_C,
			BINARY_THRESHOLD_TYPE, // INV: Mark -> White (255), BG -> Black (0)
			ADAPTIVE_THRESH_BLOCK_SIZE,
			ADAPTIVE_THRESH_C
		);
		matsToRelease.push(threshMat);
		currentMat = threshMat;
		const openKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, MORPH_OPEN_KERNEL_SIZE);
		matsToRelease.push(openKernel);
		const openedMat = await currentMat.morphologyExAsync(openKernel, cv.MORPH_OPEN);
		matsToRelease.forEach((mat) => {
			if (mat !== openedMat) tryReleaseMat(mat);
		});
		return openedMat;
	} catch (error) {
		matsToRelease.forEach(tryReleaseMat);
		if (currentMat && currentMat !== inputMat && matsToRelease.indexOf(currentMat) === -1) {
			tryReleaseMat(currentMat);
		}
		throw new OmrError(
			'PREPROCESSING_FAILED',
			`Error during preprocessing: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}

/** Finds and orders the 4 square fiducial markers. */
async function findAndOrderFiducials(processedMat: cv.Mat): Promise<cv.Point2[]> {
	let contours: cv.Contour[] | null = null;
	try {
		contours = await processedMat.findContoursAsync(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
		if (!contours || contours.length === 0) {
			throw new OmrError('FIDUCIALS_NOT_FOUND', 'No initial contours found.');
		}
		const imageArea = processedMat.rows * processedMat.cols;
		const minArea = imageArea * FIDUCIAL_MIN_AREA_FACTOR;
		const maxArea = imageArea * FIDUCIAL_MAX_AREA_FACTOR;
		const potentialFiducials: { contour: cv.Contour; area: number }[] = [];
		for (const c of contours) {
			const area = c.area;
			if (area < minArea || area > maxArea) continue;
			const peri = c.arcLength(true);
			const approx = c.approxPolyDP(peri * FIDUCIAL_APPROX_EPSILON_FACTOR, true);
			if (approx.length === EXPECTED_FIDUCIAL_COUNT) {
				const rect = c.boundingRect();
				if (rect.width === 0 || rect.height === 0) continue;
				const aspectRatio = rect.width / rect.height;
				if (Math.abs(1 - aspectRatio) <= FIDUCIAL_ASPECT_RATIO_TOLERANCE) {
					potentialFiducials.push({ contour: c, area });
				}
			}
		}
		if (potentialFiducials.length < EXPECTED_FIDUCIAL_COUNT) {
			throw new OmrError(
				'FIDUCIALS_NOT_FOUND',
				`Found only ${potentialFiducials.length} potential square fiducials (expected ${EXPECTED_FIDUCIAL_COUNT}). Area range: ${minArea.toFixed(0)}-${maxArea.toFixed(0)}px`
			);
		}
		if (potentialFiducials.length > EXPECTED_FIDUCIAL_COUNT) {
			console.warn(
				`Found ${potentialFiducials.length} fiducials, using the ${EXPECTED_FIDUCIAL_COUNT} largest.`
			);
			potentialFiducials.sort((a, b) => b.area - a.area);
			potentialFiducials.splice(EXPECTED_FIDUCIAL_COUNT);
		}
		const fiducialCentroids = potentialFiducials.map((pf) => getCentroid(pf.contour));
		return orderCornerPoints(fiducialCentroids);
	} catch (error) {
		if (error instanceof OmrError) throw error;
		throw new OmrError(
			mapErrorMessageToCode(error instanceof Error ? error.message : String(error)) ||
				'FIDUCIALS_NOT_FOUND',
			`Error finding/ordering fiducials: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}

/** Applies perspective correction.*/
async function warpImage(
	originalMat: cv.Mat,
	orderedFiducialPoints: cv.Point2[]
): Promise<{ warpedColor: cv.Mat; warpedThresholded: cv.Mat }> {
	let transformMatrix: cv.Mat | null = null;
	let warpedColor: cv.Mat | null = null;
	let warpedThresholded: cv.Mat | null = null;
	try {
		const srcPoints = orderedFiducialPoints;
		const dstPoints = [
			new cv.Point2(0, 0),
			new cv.Point2(WARPED_IMAGE_WIDTH - 1, 0),
			new cv.Point2(WARPED_IMAGE_WIDTH - 1, WARPED_IMAGE_HEIGHT - 1),
			new cv.Point2(0, WARPED_IMAGE_HEIGHT - 1)
		];
		transformMatrix = cv.getPerspectiveTransform(srcPoints, dstPoints);
		warpedColor = await originalMat.warpPerspectiveAsync(
			transformMatrix,
			new cv.Size(WARPED_IMAGE_WIDTH, WARPED_IMAGE_HEIGHT),
			cv.INTER_LINEAR,
			cv.BORDER_CONSTANT,
			new cv.Vec3(255, 255, 255)
		);
		tryReleaseMat(transformMatrix);
		if (!warpedColor || warpedColor.empty) {
			throw new OmrError('WARPED_IMAGE_EMPTY', 'Warped image (color/gray) is empty.');
		}
		warpedThresholded = await preprocessImage(warpedColor); // Preprocess AFTER warping
		if (!warpedThresholded || warpedThresholded.empty) {
			throw new OmrError('WARPED_IMAGE_EMPTY', 'Warped and thresholded image is empty.');
		}
		return { warpedColor, warpedThresholded };
	} catch (error) {
		tryReleaseMat(transformMatrix);
		tryReleaseMat(warpedColor);
		tryReleaseMat(warpedThresholded);
		if (error instanceof OmrError) throw error;
		throw new OmrError(
			'WARP_FAILED',
			`Error during perspective warp or post-warp preprocessing: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}

/** Extracts Code and Answer ROIs using FIXED coordinates. */
function extractROIs(warpedThreshMat: cv.Mat): { codeROI: cv.Mat; answersROI: cv.Mat } {
	let codeROI: cv.Mat | null = null;
	let answersROI: cv.Mat | null = null;
	try {
		const h = warpedThreshMat.rows; // WARPED_IMAGE_HEIGHT
		const w = warpedThreshMat.cols; // WARPED_IMAGE_WIDTH

		// --- Code ROI ---
		if (
			CODE_ROI_X_PX < 0 ||
			CODE_ROI_Y_PX < 0 ||
			CODE_ROI_WIDTH_PX <= 0 ||
			CODE_ROI_HEIGHT_PX <= 0
		) {
			throw new OmrError(
				'ROI_EXTRACTION_FAILED',
				`Code ROI definition has invalid coordinates/dimensions.`
			);
		}
		const clampedCodeX = Math.max(0, CODE_ROI_X_PX);
		const clampedCodeY = Math.max(0, CODE_ROI_Y_PX);
		const clampedCodeW = Math.min(CODE_ROI_WIDTH_PX, w - clampedCodeX);
		const clampedCodeH = Math.min(CODE_ROI_HEIGHT_PX, h - clampedCodeY);

		if (clampedCodeW <= 0 || clampedCodeH <= 0) {
			throw new OmrError(
				'ROI_EXTRACTION_FAILED',
				`Code ROI has zero or negative size after clamping to image bounds.`
			);
		}
		const codeRect = new cv.Rect(clampedCodeX, clampedCodeY, clampedCodeW, clampedCodeH);

		// --- Answers ROI ---
		// 1. Calculate theoretical dimensions based on constants
		const theoreticalAnswersX = ANSWERS_MARGIN_LEFT_PX;
		const theoreticalAnswersY = ANSWERS_GLOBAL_Y_START_PX;
		const theoreticalAnswersW = w - ANSWERS_MARGIN_LEFT_PX - ANSWERS_MARGIN_RIGHT_PX;
		// Calculate required height based on number of questions per column and vertical pitch
		const requiredAnswersHeight =
			(QUESTIONS_PER_COLUMN - 1) * ANSWERS_VERTICAL_PITCH_PX + ANSWERS_BUBBLE_HEIGHT_PX;
		const theoreticalAnswersH = requiredAnswersHeight;

		// 2. Calculate final coordinates and dimensions, ensuring positivity and clamping
		const finalAnswersX = Math.max(0, Math.round(theoreticalAnswersX));
		const finalAnswersY = Math.max(0, Math.round(theoreticalAnswersY));

		// Calculate initial positive width/height based on theoretical values
		let finalAnswersW = Math.max(1, Math.round(theoreticalAnswersW));
		let finalAnswersH = Math.max(1, Math.round(theoreticalAnswersH));

		// Apply clamping based on image bounds *and the calculated starting position*
		finalAnswersW = Math.min(finalAnswersW, w - finalAnswersX);
		finalAnswersH = Math.min(finalAnswersH, h - finalAnswersY);

		// 3. Final check for non-positive dimensions after clamping
		if (finalAnswersW <= 0 || finalAnswersH <= 0) {
			throw new OmrError(
				'ROI_EXTRACTION_FAILED',
				`Answers ROI calculated dimensions (${finalAnswersW}x${finalAnswersH}) are non-positive after clamping to image bounds (${w}x${h}). Start: (${finalAnswersX},${finalAnswersY}). Theoretical: W=${theoreticalAnswersW.toFixed(1)}, H=${theoreticalAnswersH.toFixed(1)}`
			);
		}

		// 4. Create the Rect with final, valid, clamped dimensions
		const answersRect = new cv.Rect(finalAnswersX, finalAnswersY, finalAnswersW, finalAnswersH);

		// 5. Extract regions (views using the validated Rects)
		// getRegion internally handles if the Rect slightly exceeds due to rounding,
		// but our Rect object itself is now guaranteed to represent a valid region within bounds.
		codeROI = warpedThreshMat.getRegion(codeRect);
		answersROI = warpedThreshMat.getRegion(answersRect);

		// 6. Validate extracted views are not empty (shouldn't happen if Rects are valid)
		if (!codeROI || codeROI.empty) {
			throw new OmrError('CODE_ROI_EMPTY', 'Extracted Code ROI view is empty despite valid Rect.');
		}
		if (!answersROI || answersROI.empty) {
			throw new OmrError(
				'ANSWERS_ROI_EMPTY',
				'Extracted Answers ROI view is empty despite valid Rect.'
			);
		}

		return { codeROI, answersROI }; // Return the views
	} catch (error) {
		// Log details for debugging ROI issues
		console.error(
			`Error details during ROI extraction: Image(${warpedThreshMat.cols}x${warpedThreshMat.rows})`,
			error
		);
		if (error instanceof OmrError) throw error;
		throw new OmrError(
			'ROI_EXTRACTION_FAILED',
			`Unexpected error extracting ROIs: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}

function isBubbleFilled_Ratio(
	roi: cv.Mat, // The specific ROI (Code or Answers)
	centerX: number, // Center X relative to ROI's top-left
	centerY: number, // Center Y relative to ROI's top-left
	bubbleWidth: number, // Precise width of the bubble
	bubbleHeight: number // Precise height of the bubble
): boolean {
	let sampleROI: cv.Mat | null = null;
	try {
		// Define the central sampling area based on BUBBLE_SAMPLE_AREA_RATIO
		const sampleWidth = Math.max(1, Math.round(bubbleWidth * BUBBLE_SAMPLE_AREA_RATIO));
		const sampleHeight = Math.max(1, Math.round(bubbleHeight * BUBBLE_SAMPLE_AREA_RATIO));
		const sampleX = Math.max(0, Math.round(centerX - sampleWidth / 2));
		const sampleY = Math.max(0, Math.round(centerY - sampleHeight / 2));

		// Clamp coordinates and dimensions to stay within the ROI boundaries
		const roiW = roi.cols;
		const roiH = roi.rows;
		const clampedX = Math.min(sampleX, roiW - 1);
		const clampedY = Math.min(sampleY, roiH - 1);
		// Ensure width/height don't exceed ROI bounds from the clamped start point
		const clampedW = Math.max(1, Math.min(sampleWidth, roiW - clampedX));
		const clampedH = Math.max(1, Math.min(sampleHeight, roiH - clampedY));

		if (clampedW <= 0 || clampedH <= 0) {
			console.warn(
				`Bubble sample area at (${centerX.toFixed(1)}, ${centerY.toFixed(1)}) resulted in zero size after clamping.`
			);
			return false; 
		}

		const sampleRect = new cv.Rect(clampedX, clampedY, clampedW, clampedH);
		sampleROI = roi.getRegion(sampleRect); // Get view (no release needed)

		if (sampleROI.empty) {
			console.warn(
				`Bubble sample ROI at rect (${clampedX},${clampedY},${clampedW},${clampedH}) is empty.`
			);
			return false;
		}

		const totalPixels = sampleROI.rows * sampleROI.cols;
		if (totalPixels === 0) return false; // Avoid division by zero

		// Count non-zero pixels (WHITE pixels, since we used THRESH_BINARY_INV)
		const filledPixels = sampleROI.countNonZero();
		const filledRatio = filledPixels / totalPixels;

		// Return true if the ratio of white pixels meets the threshold
		return filledRatio >= BUBBLE_FILL_THRESHOLD_RATIO;
	} catch (e) {
		console.error(
			`Error in isBubbleFilled_Ratio at (${centerX.toFixed(1)}, ${centerY.toFixed(1)}) ` +
				`bubble=(${bubbleWidth.toFixed(1)}x${bubbleHeight.toFixed(1)}):`,
			e
		);
		return false; // Treat as not filled on error
	}
}

/** Processes the student code block using PRECISE PITCHES relative to the ROI start. */
function processCodeBlock_PreciseRelative(codeROI: cv.Mat): string {
	// Assumes codeROI is a VIEW or a COPY. If a copy, release is handled by the caller.
	try {
		if (!codeROI || codeROI.empty) {
			throw new OmrError('CODE_ROI_EMPTY', 'Input codeROI for processing is empty.');
		}

		// Calculate the center coordinates of the *first* bubble (row 0, col 0)
		// relative to the top-left corner of the codeROI.
		const firstBubbleCenterX = CODE_BUBBLE_WIDTH_PX / 2;
		const firstBubbleCenterY = CODE_BUBBLE_HEIGHT_PX / 2;

		let studentCode = '';
		for (let r = 0; r < NUM_CODE_DIGITS; r++) {
			// Rows (Digits 0-3)
			const currentCenterY = firstBubbleCenterY + r * CODE_VERTICAL_PITCH_PX;
			let detectedDigit = -1;
			let marksInRow = 0;

			for (let c = 0; c < CODE_OPTIONS_PER_DIGIT; c++) {
				// Columns (Options 0-9)
				const currentCenterX = firstBubbleCenterX + c * CODE_HORIZONTAL_PITCH_PX;

				// Check if the bubble at this precise relative location is filled
				if (
					isBubbleFilled_Ratio(
						codeROI,
						currentCenterX,
						currentCenterY,
						CODE_BUBBLE_WIDTH_PX,
						CODE_BUBBLE_HEIGHT_PX
					)
				) {
					marksInRow++;
					detectedDigit = c; // Column index corresponds to the digit
				}
			}

			// Assign digit or error mark ('X')
			if (marksInRow === 1) {
				studentCode += detectedDigit.toString();
			} else {
				studentCode += 'X'; // Error: No mark or multiple marks
				if (marksInRow > 1) {
					console.warn(`Precise Code: Multiple marks (${marksInRow}) detected in digit row ${r}.`);
				} else if (marksInRow === 0) {
					// console.log(`Precise Code: No mark detected in digit row ${r}.`); // Optional: Log missing marks
				}
			}
		}
		// Ensure final length (shouldn't be needed if loops are correct)
		return studentCode.padEnd(NUM_CODE_DIGITS, 'X');
	} catch (error) {
		if (error instanceof OmrError) throw error;
		throw new OmrError(
			'CODE_PROCESSING_FAILED',
			`Error processing code block with precise relative coords: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}

/** Processes the answers block using PRECISE PITCHES relative to the ROI start. */
function processAnswersBlock_PreciseRelative(
	answersROI: cv.Mat,
	numQuestionsToProcess: number
): Record<number, AnswerValue> {
	// Returns 0-based index answers
	// Assumes answersROI is a VIEW or a COPY. If a copy, release is handled by the caller.
	try {
		if (!answersROI || answersROI.empty) {
			throw new OmrError('ANSWERS_ROI_EMPTY', 'Input answersROI for processing is empty.');
		}

		// Calculate the center Y of the *first row* (question 1, 21, 41, 61)
		// relative to the top of the answersROI.
		const firstRowCenterY_relative = ANSWERS_BUBBLE_HEIGHT_PX / 2;

		const answers: Record<number, AnswerValue> = {}; // 0-based index

		for (let qIndex = 0; qIndex < numQuestionsToProcess; qIndex++) {
			const colBlockIndex = Math.floor(qIndex / QUESTIONS_PER_COLUMN); // Which block (0-3)
			const rowIndexInBlock = qIndex % QUESTIONS_PER_COLUMN; // Row within block (0-19)

			// Check if the column block index is valid
			if (colBlockIndex >= ANSWERS_GROUP_X_STARTS_PX.length) {
				console.error(
					`Invalid column block index ${colBlockIndex} for question index ${qIndex}. Max index is ${ANSWERS_GROUP_X_STARTS_PX.length - 1}.`
				);
				answers[qIndex] = 'error_multiple'; // Or throw? Mark as error for now.
				continue;
			}

			// Calculate the Y center for the current question row, relative to answersROI top
			const questionCenterY_relative =
				firstRowCenterY_relative + rowIndexInBlock * ANSWERS_VERTICAL_PITCH_PX;

			// Calculate the X coordinate of the *start* of the current group, relative to answersROI left edge.
			// This requires knowing the original margin used for extraction.
			const groupStartX_relative =
				ANSWERS_GROUP_X_STARTS_PX[colBlockIndex] - ANSWERS_MARGIN_LEFT_PX;

			// Calculate the X center of the *first option ('A')* in this group, relative to answersROI left edge.
			const optionA_CenterX_relative = groupStartX_relative + ANSWERS_BUBBLE_WIDTH_PX / 2;

			let markedOptionIndex = -1; // Index of the marked option (0=A, 1=B, ...)
			let marksInQuestion = 0;

			for (let optIndex = 0; optIndex < NUM_ANSWER_OPTIONS; optIndex++) {
				// Iterate A-E
				// Calculate the X center for the current option bubble
				const optionCenterX_relative =
					optionA_CenterX_relative + optIndex * ANSWERS_HORIZONTAL_PITCH_PX;

				// Check if the bubble at this precise relative location is filled
				if (
					isBubbleFilled_Ratio(
						answersROI,
						optionCenterX_relative,
						questionCenterY_relative,
						ANSWERS_BUBBLE_WIDTH_PX,
						ANSWERS_BUBBLE_HEIGHT_PX
					)
				) {
					marksInQuestion++;
					markedOptionIndex = optIndex;
				}
			}

			// Assign answer (0-based index)
			if (marksInQuestion === 0) {
				answers[qIndex] = null;
			} else if (marksInQuestion === 1) {
				answers[qIndex] = ANSWER_OPTIONS[markedOptionIndex];
			} else {
				answers[qIndex] = 'error_multiple'; // Consistent error value
				if (marksInQuestion > 1) {
					console.warn(
						`Precise Answers: Multiple marks (${marksInQuestion}) detected in question index ${qIndex} (1-based: ${qIndex + 1}).`
					);
				}
			}
		}
		return answers; // 0-based index
	} catch (error) {
		if (error instanceof OmrError) throw error;
		throw new OmrError(
			'ANSWER_PROCESSING_FAILED',
			`Error processing answers block with precise relative coords: ${error instanceof Error ? error.message : String(error)}`,
			error
		);
	}
}

// --- Función Principal OMR ---
export async function omrProcessor(
	imageBuffer: Buffer,
	numberOfQuestions: number,
	enableDebug: boolean = false
): Promise<OmrResult> {
	// Mats needing explicit release
	const matsToRelease: (cv.Mat | null | undefined)[] = [];
	let originalMat: cv.Mat | null = null;
	let processedForFiducials: cv.Mat | null = null;
	let warpedColorMat: cv.Mat | null = null;
	let warpedThreshMat: cv.Mat | null = null;
	let codeROI_View: cv.Mat | null = null;
	let answersROI_View: cv.Mat | null = null;

	try {
		// 1. Validate Parameters
		if (
			typeof numberOfQuestions !== 'number' ||
			!Number.isInteger(numberOfQuestions) ||
			numberOfQuestions <= 0 ||
			numberOfQuestions > MAX_QUESTIONS_LAYOUT
		) {
			throw new OmrError(
				'INVALID_PARAMS',
				`Invalid number of questions: ${numberOfQuestions}. Must be int between 1 and ${MAX_QUESTIONS_LAYOUT}.`
			);
		}
		const numQuestionsToProcess = numberOfQuestions;

		// 2. Decode Image
		try {
			originalMat = await cv.imdecodeAsync(imageBuffer);
			if (!originalMat || originalMat.empty) {
				throw new OmrError('IMAGE_EMPTY', 'Decoded image is empty or invalid.');
			}
			matsToRelease.push(originalMat);
		} catch (error) {
			throw new OmrError(
				'DECODE_FAILED',
				`Failed to decode image buffer: ${error instanceof Error ? error.message : String(error)}`,
				error
			);
		}

		// 3. Preprocess for Fiducial Detection
		processedForFiducials = await preprocessImage(originalMat);
		matsToRelease.push(processedForFiducials);

		// 4. Find and Order Fiducials
		const orderedFiducialPoints = await findAndOrderFiducials(processedForFiducials);

		// 5. Warp Image
		const warpResult = await warpImage(originalMat, orderedFiducialPoints);
		warpedColorMat = warpResult.warpedColor;
		warpedThreshMat = warpResult.warpedThresholded; 
		matsToRelease.push(warpedColorMat);
		matsToRelease.push(warpedThreshMat); 

		// 6. Extract ROIs
		const rois = extractROIs(warpedThreshMat); 
		codeROI_View = rois.codeROI;
		answersROI_View = rois.answersROI;

		// 7. Process Code Block (using the VIEW and precise relative logic)
		const studentCode = processCodeBlock_PreciseRelative(codeROI_View);

		// 8. Process Answers Block (using the VIEW and precise relative logic)
		const answers_0based = processAnswersBlock_PreciseRelative(
			answersROI_View,
			numQuestionsToProcess
		);

		// 9. Map Answer Indices to 1-based for the resul -- setp 9 and 10 needs refactor?
		const answers: { [questionNumber: number]: AnswerValue } = {};
		for (const zeroIdxStr in answers_0based) {
			const zeroIdx = parseInt(zeroIdxStr, 10);
			if (!isNaN(zeroIdx)) {
				answers[zeroIdx + 1] = answers_0based[zeroIdx];
			}
		}

		// 10. Assemble Success Result
		const result: OmrSuccessResult = {
			status: 'success',
			studentCode,
			answers: answers
		};
		if (enableDebug) {
			result.debug = { warpedThresholdedImage: matToBase64(warpedThreshMat) };
		}
		matsToRelease.forEach(tryReleaseMat);

		return result;
	} catch (error) {
		let debugImageOnError: string | null = null;
		if (enableDebug) {
			const debugMat =
				warpedThreshMat ??
				warpedColorMat ??
				processedForFiducials ??
				originalMat ??
				null;
			debugImageOnError = matToBase64(debugMat);
		}

		console.error('Error during OMR processing (Improved):', error);
		matsToRelease.forEach(tryReleaseMat);

		return createErrorResult(
			error,
			'UNEXPECTED_ERROR',
			error instanceof Error ? error.message : 'Unexpected OMR processing error',
			debugImageOnError
		);
	}
}
