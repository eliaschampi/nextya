// src/lib/omrProcessor.ts

import * as cv from '@u4/opencv4nodejs';
import { Buffer } from 'buffer';

export interface OmrParams {
	numQuestions: number;
	selectionRect?: { top: number; left: number; width: number; height: number };
}

export type AnswerValue = 'a' | 'b' | 'c' | 'd' | 'e' | null | 'error_multiple';

export interface OmrSuccessResult {
	status: 'success';
	studentCode: string;
	answers: {
		[questionIndex: number]: AnswerValue;
	};
	debug?: {
		warpedImage?: string;
		thresholdedWarpedImage?: string;
	};
}

export interface OmrErrorResult {
	status: 'error';
	errorCode:
		| 'DECODE_FAILED' // Cannot decode input image data
		| 'PREPROCESSING_ERROR' // Error during grayscale, blur, or initial threshold
		| 'MARKERS_NOT_FOUND' // Cannot find the required 32 markers
		| 'MARKER_SORTING_ERROR' // Failed to sort markers into a usable grid
		| 'WARP_FAILED' // Perspective correction failed
		| 'ROI_SEGMENTATION_ERROR' // Error calculating or extracting Regions of Interest
		| 'CODE_DETECTION_FAILED' // Cannot reliably read the 4-digit student code
		| 'ANSWER_DETECTION_FAILED' // Error during the answer extraction process
		| 'INVALID_PARAMS' // Input OmrParams are invalid
		| 'UNKNOWN_ERROR'; // Catch-all for unexpected errors
	message: string;
	debug?: {
		originalImage?: string;
		processedImage?: string;
	};
}

export type OmrResult = OmrSuccessResult | OmrErrorResult;

// --- Constants ---

// Image Processing
const GAUSSIAN_BLUR_KERNEL_SIZE = new cv.Size(5, 5);
const THRESHOLD_TYPE = cv.THRESH_BINARY_INV + cv.THRESH_OTSU; // Marks become white

// Marker Detection
const MARKER_MIN_AREA = 50;
const MARKER_MAX_AREA = 2000;
const MARKER_APPROX_EPSILON_FACTOR = 0.04; // For approxPolyDP accuracy
const EXPECTED_MARKER_COUNT = 32; // Specific to 8x4 grid layout
const MARKER_GRID_ROWS = 8;
const MARKER_GRID_COLS = 4;
const MARKER_SORT_Y_TOLERANCE = 20; // Pixel tolerance for grouping markers in rows

// Perspective Correction
const WARPED_WIDTH = 700; // Target width for the warped image
const WARPED_HEIGHT = Math.round(WARPED_WIDTH * 1.414); // Target height ~A4/A5 ratio (sqrt(2))

// Bubble Analysis
const BUBBLE_THRESHOLD_RATIO = 0.35; // Min % of white pixels in padded ROI to be 'filled'
const MULTIPLE_MARK_THRESHOLD_RATIO = 0.8; // If second mark ratio > this * best ratio -> 'multiple'
const BUBBLE_INNER_PADDING_RATIO = 0.15; // % padding inside bubble ROI to avoid edges

// Layout Constants (Specific to the assumed A5 vertical, 3-content-column layout)
const ANSWER_OPTIONS = ['a', 'b', 'c', 'd', 'e'] as const;
const NUM_ANSWER_OPTIONS = ANSWER_OPTIONS.length; // 5
const NUM_CODE_DIGITS = 4;
const CODE_OPTIONS_COUNT = 10; // Digits 0-9
const MAX_QUESTIONS = 80;

// Question distribution per column (0-based indexing)
const QUESTIONS_COL1_COUNT = 20; // Q 1-20   => Index 0-19
const QUESTIONS_COL2_COUNT = 35; // Q 21-55  => Index 20-54
const QUESTIONS_COL3_COUNT = 25; // Q 56-80  => Index 55-79

const COL1_WIDTH_RATIO = 0.33; // Approx width ratio for the first column (Code + Answers 1-20)
const COL2_WIDTH_RATIO = 0.34; // Approx width ratio for the second column (Answers 21-55)
// const COL3_WIDTH_RATIO = 1.0 - COL1_WIDTH_RATIO - COL2_WIDTH_RATIO; // Approx 0.33
const CODE_BLOCK_HEIGHT_RATIO = 0.35; // Approx height ratio of Col 1 used for the student code

// --- Helper Functions ---
function getCentroid(contour: cv.Contour): cv.Point2 {
	const m = contour.moments();
	// Prevent division by zero
	const cx = m.m00 !== 0 ? m.m10 / m.m00 : 0;
	const cy = m.m00 !== 0 ? m.m01 / m.m00 : 0;
	return new cv.Point2(cx, cy);
}

function sortMarkersGrid(
	contours: cv.Contour[],
	rows: number,
	cols: number,
	yTolerance: number = MARKER_SORT_Y_TOLERANCE,
	enableDebug: boolean = false
): cv.Contour[] {
	const expectedCount = rows * cols;
	if (!contours || contours.length !== expectedCount) {
		// Throwing here simplifies the main logic flow
		throw new Error(
			`Marker Sorting Error: Expected ${expectedCount} contours, but received ${contours?.length ?? 0}.`
		);
	}

	const contoursWithCentroids = contours.map((c) => ({ contour: c, centroid: getCentroid(c) }));

	// Sort primarily by Y-coordinate
	contoursWithCentroids.sort((a, b) => a.centroid.y - b.centroid.y);

	const sortedGrid: cv.Contour[] = [];
	for (let i = 0; i < rows; i++) {
		const rowStartIndex = i * cols;
		const rowEndIndex = (i + 1) * cols;
		// Get the slice presumed to be in this row
		const rowSlice = contoursWithCentroids.slice(rowStartIndex, rowEndIndex);

		// Check Y-coordinate consistency within the presumed row (optional debug check)
		if (enableDebug && rowSlice.length > 1) {
			const avgY = rowSlice.reduce((sum, c) => sum + c.centroid.y, 0) / rowSlice.length;
			const maxYDiff = Math.max(...rowSlice.map((c) => Math.abs(c.centroid.y - avgY)));
			if (maxYDiff > yTolerance * 1.5) {
				// Check against tolerance
				console.warn(
					`[Debug] Potential row alignment issue in marker row ${i}. Max Y deviation: ${maxYDiff.toFixed(2)}px (Tolerance: ${yTolerance}px)`
				);
			}
		}

		// Sort this row by X-coordinate
		rowSlice.sort((a, b) => a.centroid.x - b.centroid.x);
		sortedGrid.push(...rowSlice.map((item) => item.contour));
	}

	// Final sanity check (should be redundant if initial check passed)
	if (sortedGrid.length !== expectedCount) {
		throw new Error(
			`Marker Sorting Error: Sorting failed to produce ${expectedCount} markers. Got ${sortedGrid.length}.`
		);
	}

	return sortedGrid;
}

function calculateBubbleFilledRatio(roi: cv.Mat): number {
	if (!roi || roi.empty || roi.rows <= 0 || roi.cols <= 0) {
		return 0.0;
	}

	// Calculate padding based on the smaller dimension
	const minDim = Math.min(roi.rows, roi.cols);
	const padding = Math.max(0, Math.floor(minDim * BUBBLE_INNER_PADDING_RATIO));

	// Calculate inner ROI dimensions, ensuring they are at least 1x1
	const innerWidth = Math.max(1, roi.cols - 2 * padding);
	const innerHeight = Math.max(1, roi.rows - 2 * padding);
	const innerX = padding;
	const innerY = padding;

	// Check if padded ROI is valid and within bounds
	if (
		innerWidth <= 0 ||
		innerHeight <= 0 ||
		innerX < 0 ||
		innerY < 0 ||
		innerX + innerWidth > roi.cols ||
		innerY + innerHeight > roi.rows
	) {
		// Fallback: Calculate ratio on the original ROI if padding makes it invalid
		const totalPixels = roi.rows * roi.cols;
		return totalPixels > 0 ? roi.countNonZero() / totalPixels : 0.0;
	}

	let paddedRoi: cv.Mat | null = null;
	try {
		// Extract the padded inner region - getRegion creates a view, efficient
		const paddedRect = new cv.Rect(innerX, innerY, innerWidth, innerHeight);
		paddedRoi = roi.getRegion(paddedRect);

		if (!paddedRoi || paddedRoi.empty) return 0.0;

		const totalPixels = paddedRoi.rows * paddedRoi.cols;
		if (totalPixels === 0) return 0.0;

		// Count non-zero pixels (marks)
		const filledPixels = paddedRoi.countNonZero();
		return filledPixels / totalPixels;
	} catch (error) {
		// This catch is mainly for unexpected errors with getRegion or countNonZero
		console.error(
			'Error calculating bubble filled ratio:',
			error instanceof Error ? error.message : error
		);
		return 0.0; // Return 0 on error
	}
	// No 'finally { release }' needed here for paddedRoi obtained via getRegion;
	// the underlying data belongs to the parent 'roi' Mat which is managed elsewhere.
}

function matToBase64(mat: cv.Mat | null): string | null {
	if (!mat || mat.empty) {
		return null;
	}
	try {
		const buffer = cv.imencode('.jpg', mat);
		return `data:image/jpeg;base64,${buffer.toString('base64')}`;
	} catch (error) {
		console.error('Error encoding Mat to Base64:', error instanceof Error ? error.message : error);
		return null;
	}
}

function tryReleaseMat(mat: cv.Mat | null | undefined): void {
	// Check if mat exists, is not empty, and has the release method (robust check)
	if (mat && !mat.empty && typeof mat.release === 'function') {
		try {
			mat.release();
		} catch {
			// Ignore potential errors during release (e.g., already released)
			// console.warn("Ignored error during Mat release:", e);
		}
	}
}
//  --- Main Function ---
export async function processOmrImage(
	imageData: Buffer | string,
	omrParams: OmrParams,
	enableDebug: boolean = false
): Promise<OmrResult> {
	const matsToRelease: (cv.Mat | null | undefined)[] = [];
	const debugImages: Record<string, string | null> = {};

	try {
		// --- 1. Validate Parameters ---
		if (!omrParams || typeof omrParams.numQuestions !== 'number' || omrParams.numQuestions <= 0) {
			return {
				status: 'error',
				errorCode: 'INVALID_PARAMS',
				message: `Invalid parameters: numQuestions must be a positive number. Received: ${omrParams?.numQuestions ?? 'undefined'}`
			};
		}
		// Clamp numQuestions to the maximum supported by the layout
		const numQuestionsToProcess = Math.min(omrParams.numQuestions, MAX_QUESTIONS);
		if (enableDebug && numQuestionsToProcess !== omrParams.numQuestions) {
			console.log(
				`[Debug] Requested ${omrParams.numQuestions} questions, processing layout max of ${MAX_QUESTIONS}.`
			);
		}
		if (numQuestionsToProcess <= 0) {
			return {
				status: 'error',
				errorCode: 'INVALID_PARAMS',
				message: 'Number of questions to process resulted in zero or less after clamping.'
			};
		}

		// --- 2. Decode Image ---
		let originalMat: cv.Mat | null = null;
		try {
			const buffer = Buffer.isBuffer(imageData)
				? imageData
				: Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

			// Use imdecodeAsync for potential slight performance gain (I/O bound)
			originalMat = await cv.imdecodeAsync(buffer);
			matsToRelease.push(originalMat);

			if (!originalMat || originalMat.empty) {
				// Throw specific error to be caught below
				throw new Error('Decoded image is empty or invalid.');
			}
			if (enableDebug) debugImages['original'] = matToBase64(originalMat);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown decoding error';
			return {
				status: 'error',
				errorCode: 'DECODE_FAILED',
				message: `Failed to decode image data: ${message}. Ensure valid image format (JPEG, PNG).`
			};
		}

		// --- 3. Pre-processing ---
		let grayMat: cv.Mat | null = null;
		let threshMat: cv.Mat | null = null; // Thresholded before warp (for markers)
		try {
			// Ensure originalMat is valid before proceeding
			if (!originalMat || originalMat.empty) {
				throw new Error('Cannot preprocess: Original image is invalid after decode.');
			}
			grayMat = await originalMat.cvtColorAsync(cv.COLOR_BGR2GRAY);
			matsToRelease.push(grayMat);
			const blurredMat = await grayMat.gaussianBlurAsync(GAUSSIAN_BLUR_KERNEL_SIZE, 0);
			matsToRelease.push(blurredMat); // Keep blur intermediate for release
			threshMat = await blurredMat.thresholdAsync(0, 255, THRESHOLD_TYPE);
			matsToRelease.push(threshMat);

			if (enableDebug) {
				debugImages['thresholded_pre_warp'] = matToBase64(threshMat);
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown preprocessing error';
			return {
				status: 'error',
				errorCode: 'PREPROCESSING_ERROR',
				message: `Image preprocessing failed: ${message}`
			};
		}
		let sortedMarkers: cv.Contour[];
		try {
			if (!threshMat || threshMat.empty) {
				throw new Error('Cannot find markers: Preprocessed image is invalid.');
			}
			const contours = await threshMat.findContoursAsync(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

			// Filter contours based on area and quadrilateral shape
			const potentialMarkers = contours.filter((c) => {
				const area = c.area;
				if (area < MARKER_MIN_AREA || area > MARKER_MAX_AREA) return false;
				const peri = c.arcLength(true); // Closed contour
				const approx = c.approxPolyDP(MARKER_APPROX_EPSILON_FACTOR * peri, true);
				// Allow for slight variation in approxPolyDP result if needed, but 4 is ideal
				return approx.length === 4;
			});

			if (potentialMarkers.length < EXPECTED_MARKER_COUNT) {
				const dbgImg = enableDebug ? matToBase64(threshMat) : undefined;
				return {
					status: 'error',
					errorCode: 'MARKERS_NOT_FOUND',
					message: `Could not find enough markers (${potentialMarkers.length}/${EXPECTED_MARKER_COUNT}). Check image quality, lighting, scan resolution, and marker integrity.`,
					debug: dbgImg ? { processedImage: dbgImg } : undefined
				};
			}
			// If more than expected found, log and proceed with the count needed for sorting
			if (potentialMarkers.length > EXPECTED_MARKER_COUNT && enableDebug) {
				console.log(
					`[Debug] Found ${potentialMarkers.length} potential markers (expected ${EXPECTED_MARKER_COUNT}). Using the first ${EXPECTED_MARKER_COUNT} for sorting grid.`
				);
			}

			// Sort the markers into the grid (throws on structural failure)
			// Pass only the expected number to the sorting function
			sortedMarkers = sortMarkersGrid(
				potentialMarkers.slice(0, EXPECTED_MARKER_COUNT),
				MARKER_GRID_ROWS,
				MARKER_GRID_COLS,
				MARKER_SORT_Y_TOLERANCE,
				enableDebug
			);
		} catch (error: unknown) {
			// Catch errors from findContoursAsync OR sortMarkersGrid
			const message =
				error instanceof Error ? error.message : 'Unknown marker detection/sorting error';
			const errorCode = message.includes('Marker Sorting Error')
				? 'MARKER_SORTING_ERROR'
				: 'MARKERS_NOT_FOUND';
			return { status: 'error', errorCode: errorCode, message: message };
		}

		// --- 5. Perspective Correction ---
		let warpedGrayMat: cv.Mat | null = null;
		let warpedThreshMat: cv.Mat | null = null; // Thresholded *after* warp (for bubbles)
		let transformMatrix: cv.Mat | null = null;
		try {
			// Identify corner markers from the reliably sorted grid
			const topLeftMarker = sortedMarkers[0]; // Index 0
			const topRightMarker = sortedMarkers[MARKER_GRID_COLS - 1]; // Index 3 (for 4 cols)
			const bottomLeftMarker = sortedMarkers[EXPECTED_MARKER_COUNT - MARKER_GRID_COLS]; // Index 28 (for 8x4 grid)
			const bottomRightMarker = sortedMarkers[EXPECTED_MARKER_COUNT - 1]; // Index 31

			// Source points: Centroids of the corner markers
			const srcPoints = [
				getCentroid(topLeftMarker),
				getCentroid(topRightMarker),
				getCentroid(bottomRightMarker), // Order for getPerspectiveTransform: TL, TR, BR, BL
				getCentroid(bottomLeftMarker)
			].map((p) => new cv.Point2(p.x, p.y));

			// Destination points for the warped image
			const dstPoints = [
				new cv.Point2(0, 0),
				new cv.Point2(WARPED_WIDTH - 1, 0),
				new cv.Point2(WARPED_WIDTH - 1, WARPED_HEIGHT - 1),
				new cv.Point2(0, WARPED_HEIGHT - 1)
			];

			// Calculate the transformation matrix
			transformMatrix = cv.getPerspectiveTransform(srcPoints, dstPoints);
			matsToRelease.push(transformMatrix);

			// Apply perspective warp to the GRAYSCALE image (better interpolation than binary)
			if (!grayMat || grayMat.empty) {
				throw new Error('Cannot warp perspective: Grayscale image is invalid.');
			}
			warpedGrayMat = await grayMat.warpPerspectiveAsync(
				transformMatrix,
				new cv.Size(WARPED_WIDTH, WARPED_HEIGHT),
				cv.INTER_LINEAR, // Linear interpolation is usually a good balance
				cv.BORDER_CONSTANT, // How to fill outside pixels
				new cv.Vec4(255, 255, 255, 255) // Fill with white
			);
			matsToRelease.push(warpedGrayMat);

			if (!warpedGrayMat || warpedGrayMat.empty) {
				throw new Error('Perspective warp resulted in an empty image.');
			}

			warpedThreshMat = await warpedGrayMat.thresholdAsync(0, 255, THRESHOLD_TYPE);
			matsToRelease.push(warpedThreshMat);

			if (enableDebug) {
				debugImages['warpedImage'] = matToBase64(warpedGrayMat);
				debugImages['thresholdedWarpedImage'] = matToBase64(warpedThreshMat);
			}
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : 'Unknown perspective correction error';
			console.error('Perspective warp failed:', message); // Log internal error details
			return {
				status: 'error',
				errorCode: 'WARP_FAILED',
				message: `Error during perspective correction: ${message}. Check marker detection and sheet condition.`
			};
		}

		let codeRoi: cv.Mat | null = null;
		let ansRoi1: cv.Mat | null = null;
		let ansRoi2: cv.Mat | null = null;
		let ansRoi3: cv.Mat | null = null;
		try {
			if (!warpedThreshMat || warpedThreshMat.empty) {
				throw new Error('Cannot segment ROIs: Warped thresholded image is invalid.');
			}
			const col1X = 0;
			const col1Width = Math.round(WARPED_WIDTH * COL1_WIDTH_RATIO);
			const col2X = col1X + col1Width;
			const col2Width = Math.round(WARPED_WIDTH * COL2_WIDTH_RATIO);
			const col3X = col2X + col2Width;
			const col3Width = WARPED_WIDTH - col3X;

			const codeBlockHeight = Math.round(WARPED_HEIGHT * CODE_BLOCK_HEIGHT_RATIO);
			const ans1StartY = codeBlockHeight;
			const ans1Height = WARPED_HEIGHT - ans1StartY;

			const makeValidRect = (
				x: number,
				y: number,
				w: number,
				h: number,
				imgW: number,
				imgH: number
			): cv.Rect | null => {
				const validX = Math.max(0, Math.round(x));
				const validY = Math.max(0, Math.round(y));
				const validW = Math.max(1, Math.round(w - (validX - Math.round(x))));
				const validH = Math.max(1, Math.round(h - (validY - Math.round(y))));

				const finalW = Math.min(validW, imgW - validX);
				const finalH = Math.min(validH, imgH - validY);

				if (finalW <= 0 || finalH <= 0) return null; // Invalid dimensions after clamping
				return new cv.Rect(validX, validY, finalW, finalH);
			};

			const codeRoiRect = makeValidRect(
				col1X,
				0,
				col1Width,
				codeBlockHeight,
				WARPED_WIDTH,
				WARPED_HEIGHT
			);
			const ansRoiRect1 = makeValidRect(
				col1X,
				ans1StartY,
				col1Width,
				ans1Height,
				WARPED_WIDTH,
				WARPED_HEIGHT
			);
			const ansRoiRect2 = makeValidRect(
				col2X,
				0,
				col2Width,
				WARPED_HEIGHT,
				WARPED_WIDTH,
				WARPED_HEIGHT
			);
			const ansRoiRect3 = makeValidRect(
				col3X,
				0,
				col3Width,
				WARPED_HEIGHT,
				WARPED_WIDTH,
				WARPED_HEIGHT
			);

			// Validate and extract ROIs
			if (!codeRoiRect)
				throw new Error('Invalid dimensions calculated for Code ROI after clamping.');
			if (!ansRoiRect1)
				throw new Error('Invalid dimensions calculated for Answer ROI 1 after clamping.');
			if (!ansRoiRect2)
				throw new Error('Invalid dimensions calculated for Answer ROI 2 after clamping.');
			if (!ansRoiRect3)
				throw new Error('Invalid dimensions calculated for Answer ROI 3 after clamping.');

			codeRoi = warpedThreshMat.getRegion(codeRoiRect);
			ansRoi1 = warpedThreshMat.getRegion(ansRoiRect1);
			ansRoi2 = warpedThreshMat.getRegion(ansRoiRect2);
			ansRoi3 = warpedThreshMat.getRegion(ansRoiRect3);

			matsToRelease.push(codeRoi, ansRoi1, ansRoi2, ansRoi3); // Manage ROI Mats (views)

			if (codeRoi.empty || ansRoi1.empty || ansRoi2.empty || ansRoi3.empty) {
				throw new Error(
					'One or more essential ROIs (Code, Answers 1-3) are empty after extraction.'
				);
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown ROI segmentation error';
			console.error('Error segmenting ROIs:', message);
			return {
				status: 'error',
				errorCode: 'ROI_SEGMENTATION_ERROR',
				message: `Failed to segment regions: ${message}. Check warped image quality and layout ratios.`
			};
		}

		// --- 7. Student Code Extraction ---
		let studentCode: string | null = null;
		try {
			if (
				!codeRoi ||
				codeRoi.empty ||
				codeRoi.rows < CODE_OPTIONS_COUNT ||
				codeRoi.cols < NUM_CODE_DIGITS
			) {
				throw new Error(
					`Code ROI is invalid or too small. Rows: ${codeRoi?.rows ?? 0}, Cols: ${codeRoi?.cols ?? 0}`
				);
			}

			// Use floating point for precision before rounding bubble boundaries
			const digitWidth = codeRoi.cols / NUM_CODE_DIGITS;
			const bubbleHeight = codeRoi.rows / CODE_OPTIONS_COUNT;
			let extractedCode = '';

			if (digitWidth <= 0 || bubbleHeight <= 0) {
				throw new Error(
					`Invalid calculated dimensions for code bubbles. DigitWidth: ${digitWidth.toFixed(2)}, BubbleHeight: ${bubbleHeight.toFixed(2)}`
				);
			}

			for (let d = 0; d < NUM_CODE_DIGITS; d++) {
				// Loop through each digit column
				const digitRoiX = Math.round(d * digitWidth);
				// Calculate width ensuring it covers the segment and doesn't overlap excessively due to rounding
				const nextDigitRoiX = Math.round((d + 1) * digitWidth);
				const currentDigitWidth = Math.max(1, nextDigitRoiX - digitRoiX);

				// Clamp ROI to stay within the codeRoi bounds
				const clampedDigitX = Math.min(Math.max(0, digitRoiX), codeRoi.cols - 1);
				const clampedDigitW = Math.min(currentDigitWidth, codeRoi.cols - clampedDigitX);

				if (clampedDigitW <= 0) {
					console.warn(`[Warn] Code Digit ${d + 1}: Calculated width became zero after clamping.`);
					extractedCode += '?'; // Mark as undetermined
					continue;
				}

				let digitRoi: cv.Mat | null = null;
				try {
					const digitRect = new cv.Rect(clampedDigitX, 0, clampedDigitW, codeRoi.rows);
					digitRoi = codeRoi.getRegion(digitRect);
					// No need to push digitRoi to matsToRelease, it's a view of codeRoi
					const bubbleRatios: { ratio: number; digitValue: number }[] = [];

					for (let digitVal = 0; digitVal < CODE_OPTIONS_COUNT; digitVal++) {
						// 0 through 9
						const bubbleRoiY = Math.round(digitVal * bubbleHeight);
						const nextBubbleRoiY = Math.round((digitVal + 1) * bubbleHeight);
						const currentBubbleHeight = Math.max(1, nextBubbleRoiY - bubbleRoiY);

						// Clamp bubble ROI within the digitRoi
						const clampedBubbleY = Math.min(Math.max(0, bubbleRoiY), digitRoi.rows - 1);
						const clampedBubbleH = Math.min(currentBubbleHeight, digitRoi.rows - clampedBubbleY);

						if (clampedBubbleH <= 0) continue; // Skip if height is zero after clamping

						let bubbleRoi: cv.Mat | null = null;
						try {
							const bubbleRect = new cv.Rect(0, clampedBubbleY, digitRoi.cols, clampedBubbleH); // Width is full digitRoi width
							bubbleRoi = digitRoi.getRegion(bubbleRect);
							// No need to release bubbleRoi (view)

							const filledRatio = calculateBubbleFilledRatio(bubbleRoi);
							bubbleRatios.push({ ratio: filledRatio, digitValue: digitVal });
						} catch (bubbleError: unknown) {
							console.error(
								`[Error] Code Digit ${d + 1}, Value ${digitVal}: Failed to process bubble ROI.`,
								bubbleError instanceof Error ? bubbleError.message : bubbleError
							);
							// Record as low ratio if error occurs? Or skip? Let's record low ratio.
							bubbleRatios.push({ ratio: 0.0, digitValue: digitVal });
						}
					} // End loop over bubbles (0-9)

					// Analyze ratios for this digit column
					bubbleRatios.sort((a, b) => b.ratio - a.ratio); // Sort descending by fill ratio

					const bestMatch = bubbleRatios[0];
					const secondMatch = bubbleRatios.length > 1 ? bubbleRatios[1] : null;
					const maxRatio = bestMatch?.ratio ?? -1;
					const secondMaxRatio = secondMatch?.ratio ?? -1;

					// Decision Logic for Code Digit
					if (maxRatio < BUBBLE_THRESHOLD_RATIO) {
						if (enableDebug)
							console.log(
								`[Debug] Code Digit ${d + 1}: No mark detected (Max Ratio: ${maxRatio.toFixed(3)} < ${BUBBLE_THRESHOLD_RATIO}).`
							);
						extractedCode += '?'; // Undetermined
					} else if (
						secondMaxRatio >= 0 &&
						secondMaxRatio / maxRatio > MULTIPLE_MARK_THRESHOLD_RATIO
					) {
						// Check if secondMaxRatio is also above the *absolute* threshold as well for stronger ambiguity check
						if (secondMaxRatio >= BUBBLE_THRESHOLD_RATIO) {
							if (enableDebug)
								console.log(
									`[Debug] Code Digit ${d + 1}: Multiple marks detected (Ratios: ${maxRatio.toFixed(3)} vs ${secondMaxRatio.toFixed(3)}, Ratio > ${MULTIPLE_MARK_THRESHOLD_RATIO}). Ambiguous.`
								);
							extractedCode += '?'; // Ambiguous
						} else {
							// Second mark is proportionally high, but absolutely low - less likely ambiguous
							if (enableDebug)
								console.log(
									`[Debug] Code Digit ${d + 1}: Single dominant mark found (Ratio: ${maxRatio.toFixed(3)}). Second mark ratio ${secondMaxRatio.toFixed(3)} was high proportionally but below threshold.`
								);
							extractedCode += bestMatch.digitValue.toString();
						}
					} else {
						// Single dominant mark found
						if (enableDebug)
							console.log(
								`[Debug] Code Digit ${d + 1}: Mark detected for value ${bestMatch.digitValue} (Ratio: ${maxRatio.toFixed(3)}).`
							);
						extractedCode += bestMatch.digitValue.toString();
					}
				} catch (digitError: unknown) {
					console.error(
						`[Error] Code Digit ${d + 1}: Failed to process digit ROI.`,
						digitError instanceof Error ? digitError.message : digitError
					);
					extractedCode += '?'; // Mark as undetermined if the whole digit processing fails
				}
			} // End loop over digits (d)

			// Final check on the extracted code
			if (extractedCode.includes('?')) {
				throw new Error(
					`Could not reliably determine all digits of the student code. Detected: "${extractedCode}". Check sheet for missing/multiple marks in code area.`
				);
			}
			studentCode = extractedCode; // Assign the validated code
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown code detection error';
			console.error('Error processing student code block:', message);
			return {
				status: 'error',
				errorCode: 'CODE_DETECTION_FAILED',
				message: `Error extracting student code: ${message}`
			};
		}

		// --- 8. Answer Extraction ---
		// Use Record for better type safety
		const answers: Record<number, AnswerValue> = {};
		try {
			// Structure for iterating through answer columns using the extracted ROIs
			const columnLayout = [
				{ roi: ansRoi1, startQIndex: 0, numQInLayout: QUESTIONS_COL1_COUNT }, // Col 1: Q 1-20 (Indices 0-19)
				{ roi: ansRoi2, startQIndex: QUESTIONS_COL1_COUNT, numQInLayout: QUESTIONS_COL2_COUNT }, // Col 2: Q 21-55 (Indices 20-54)
				{
					roi: ansRoi3,
					startQIndex: QUESTIONS_COL1_COUNT + QUESTIONS_COL2_COUNT,
					numQInLayout: QUESTIONS_COL3_COUNT
				} // Col 3: Q 56-80 (Indices 55-79)
			];

			for (const col of columnLayout) {
				const { roi, startQIndex, numQInLayout } = col;

				// Skip if ROI is invalid or doesn't exist
				if (!roi || roi.empty) {
					console.warn(
						`[Warn] Skipping answer column starting at Q${startQIndex + 1} due to invalid/empty ROI.`
					);
					continue;
				}

				// Determine how many questions from this column's *layout* we actually need to *process*
				const processFromQIndex = startQIndex;
				const processUntilQIndex = Math.min(startQIndex + numQInLayout, numQuestionsToProcess); // Stop at layout end or requested total

				if (processUntilQIndex <= processFromQIndex) {
					continue; // No questions needed from this column for the requested total
				}

				// Calculate dimensions within this column's ROI
				// Use numQInLayout for row height calculation to maintain consistent bubble size across the designed column
				const questionRowHeight = roi.rows / numQInLayout;
				const optionBubbleWidth = roi.cols / NUM_ANSWER_OPTIONS;

				if (questionRowHeight <= 0 || optionBubbleWidth <= 0) {
					console.warn(
						`[Warn] Invalid dimensions calculated for answer column starting Q${startQIndex + 1}. RowH: ${questionRowHeight.toFixed(2)}, OptW: ${optionBubbleWidth.toFixed(2)}. Skipping column.`
					);
					// Mark questions in this range as null later in the final check
					continue;
				}

				// Iterate only through the questions needed *within this column's range*
				for (let qIndexInLayout = 0; qIndexInLayout < numQInLayout; qIndexInLayout++) {
					const currentQuestionIndex = startQIndex + qIndexInLayout; // 0-based overall question index

					// Only process if this question index is within the required range
					if (currentQuestionIndex >= numQuestionsToProcess) {
						break; // We've processed all requested questions that fall into this column
					}

					const questionRoiY = Math.round(qIndexInLayout * questionRowHeight);
					const nextQuestionRoiY = Math.round((qIndexInLayout + 1) * questionRowHeight);
					const currentQuestionHeight = Math.max(1, nextQuestionRoiY - questionRoiY);

					// Clamp question ROI Y and Height within the column ROI
					const clampedQuestionY = Math.min(Math.max(0, questionRoiY), roi.rows - 1);
					const clampedQuestionH = Math.min(currentQuestionHeight, roi.rows - clampedQuestionY);

					if (clampedQuestionH <= 0) continue; // Skip if height is zero after clamping

					let questionRoi: cv.Mat | null = null;
					try {
						const questionRect = new cv.Rect(0, clampedQuestionY, roi.cols, clampedQuestionH);
						questionRoi = roi.getRegion(questionRect);

						// No need to manage questionRoi release (view)
						const bubbleRatios: { ratio: number; optionIndex: number }[] = [];

						for (let opt = 0; opt < NUM_ANSWER_OPTIONS; opt++) {
							const bubbleRoiX = Math.round(opt * optionBubbleWidth);
							const nextBubbleRoiX = Math.round((opt + 1) * optionBubbleWidth);
							const currentBubbleWidth = Math.max(1, nextBubbleRoiX - bubbleRoiX);

							// Clamp bubble ROI X and Width within the question ROI
							const clampedBubbleX = Math.min(Math.max(0, bubbleRoiX), questionRoi.cols - 1);
							const clampedBubbleW = Math.min(
								currentBubbleWidth,
								questionRoi.cols - clampedBubbleX
							);

							if (clampedBubbleW <= 0) continue; // Skip if width is zero

							let bubbleRoi: cv.Mat | null = null;
							try {
								const bubbleRect = new cv.Rect(clampedBubbleX, 0, clampedBubbleW, questionRoi.rows); // Height is full questionRoi height
								bubbleRoi = questionRoi.getRegion(bubbleRect);
								// No need to manage bubbleRoi release (view)

								const filledRatio = calculateBubbleFilledRatio(bubbleRoi);
								bubbleRatios.push({ ratio: filledRatio, optionIndex: opt });
							} catch (bubbleError: unknown) {
								console.error(
									`[Error] Q ${currentQuestionIndex + 1}, Option ${ANSWER_OPTIONS[opt]}: Failed to process bubble ROI.`,
									bubbleError instanceof Error ? bubbleError.message : bubbleError
								);
								bubbleRatios.push({ ratio: 0.0, optionIndex: opt });
							}
						} // End loop over options (A-E)

						// Analyze ratios for this question
						bubbleRatios.sort((a, b) => b.ratio - a.ratio); // Sort descending

						const bestMatch = bubbleRatios[0];
						const secondMatch = bubbleRatios.length > 1 ? bubbleRatios[1] : null;
						const maxRatio = bestMatch?.ratio ?? -1;
						const secondMaxRatio = secondMatch?.ratio ?? -1;

						// Decision Logic for Answer
						if (maxRatio < BUBBLE_THRESHOLD_RATIO) {
							answers[currentQuestionIndex] = null; // No significant mark
						} else if (
							secondMaxRatio >= 0 &&
							secondMaxRatio / maxRatio > MULTIPLE_MARK_THRESHOLD_RATIO
						) {
							// Also check if the second mark is strong enough on its own
							if (secondMaxRatio >= BUBBLE_THRESHOLD_RATIO) {
								answers[currentQuestionIndex] = 'error_multiple'; // Multiple ambiguous marks
								if (enableDebug)
									console.log(
										`[Debug] Q${currentQuestionIndex + 1}: Multiple marks detected (Ratios: ${maxRatio.toFixed(3)} vs ${secondMaxRatio.toFixed(3)}).`
									);
							} else {
								// Second mark proportionally high, but absolutely low - treat as single mark
								answers[currentQuestionIndex] = ANSWER_OPTIONS[bestMatch.optionIndex];
								if (enableDebug)
									console.log(
										`[Debug] Q${currentQuestionIndex + 1}: Single dominant mark ${ANSWER_OPTIONS[bestMatch.optionIndex]} (Ratio: ${maxRatio.toFixed(3)}). Second ratio ${secondMaxRatio.toFixed(3)} below threshold.`
									);
							}
						} else {
							// Single dominant mark
							answers[currentQuestionIndex] = ANSWER_OPTIONS[bestMatch.optionIndex];
						}
						// Optional: Log per-question result for fine-tuning thresholds
						// if (enableDebug) console.log(`[Debug] Q ${currentQuestionIndex + 1}: Result=${answers[currentQuestionIndex]}, Best Ratio=${maxRatio.toFixed(3)}`);
					} catch (questionError: unknown) {
						console.error(
							`[Error] Q ${currentQuestionIndex + 1}: Failed to process question ROI.`,
							questionError instanceof Error ? questionError.message : questionError
						);
						answers[currentQuestionIndex] = null; // Mark as null if question processing fails
					}
				}
			}
			// Final check: Ensure all requested questions have an entry (defaulting to null if missed)
			for (let i = 0; i < numQuestionsToProcess; i++) {
				if (!(i in answers)) {
					if (enableDebug)
						console.warn(
							`[Warn] Question ${i + 1} (index ${i}) was not processed (e.g., due to skipped column). Assigning null.`
						);
					answers[i] = null;
				}
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : 'Unknown answer detection error';
			console.error('Error processing answer blocks:', message);
			return {
				status: 'error',
				errorCode: 'ANSWER_DETECTION_FAILED',
				message: `Error extracting answers: ${message}`
			};
		}

		// --- 9. Result Assembly ---
		// studentCode is guaranteed non-null here due to the check in step 7
		const successResult: OmrSuccessResult = {
			status: 'success',
			studentCode: studentCode!, // Non-null assertion is safe here
			answers: answers
		};

		if (enableDebug) {
			successResult.debug = {
				warpedImage: debugImages['warpedImage'] ?? undefined,
				thresholdedWarpedImage: debugImages['thresholdedWarpedImage'] ?? undefined
			};
		}

		return successResult;
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown internal error';
		console.error('Unhandled error during OMR processing:', error);
		const errorResult: OmrErrorResult = {
			status: 'error',
			errorCode: 'UNKNOWN_ERROR',
			message: `An unexpected error occurred: ${message}`
		};
		if (enableDebug) {
			const debugData: OmrErrorResult['debug'] = {};
			if (debugImages['original']) debugData.originalImage = debugImages['original'] ?? undefined;
			if (debugImages['thresholdedWarpedImage'])
				debugData.processedImage = debugImages['thresholdedWarpedImage'] ?? undefined;
			else if (debugImages['warpedImage'])
				debugData.processedImage = debugImages['warpedImage'] ?? undefined;
			else if (debugImages['thresholded_pre_warp'])
				debugData.processedImage = debugImages['thresholded_pre_warp'] ?? undefined;

			if (Object.keys(debugData).length > 0) {
				errorResult.debug = debugData;
			}
		}
		return errorResult;
	} finally {
		if (enableDebug)
			console.log(`[Debug] Releasing ${matsToRelease.length} tracked OpenCV Mats...`);
		matsToRelease.forEach(tryReleaseMat);
		if (enableDebug) console.log('[Debug] Mat releasing process finished.');
	}
}
