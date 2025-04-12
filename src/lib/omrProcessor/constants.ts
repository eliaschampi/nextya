// omrProcessor/constants.ts
import * as cv from '@u4/opencv4nodejs'; // Necesario para cv.Size, cv.MORPH_ELLIPSE, etc.

// --- Constantes de Layout OMR (Base) ---
export const MAX_QUESTIONS_LAYOUT = 80;
export const NUM_ANSWER_OPTIONS = 5;
export const ANSWER_OPTIONS = ['A', 'B', 'C', 'D', 'E'] as const;
export const NUM_CODE_DIGITS = 4;
export const CODE_OPTIONS_PER_DIGIT = 10;
export const ANSWER_COLUMNS_COUNT = 4;
export const QUESTIONS_PER_COLUMN = MAX_QUESTIONS_LAYOUT / ANSWER_COLUMNS_COUNT; // 20

// --- Constantes de Preprocesamiento ---
export const GAUSSIAN_BLUR_KERNEL_SIZE = new cv.Size(3, 3);
export const ADAPTIVE_THRESH_BLOCK_SIZE = 55;
export const ADAPTIVE_THRESH_C = 3;
export const BINARY_THRESHOLD_TYPE = cv.THRESH_BINARY_INV;
export const MORPH_OPEN_KERNEL_SIZE = new cv.Size(2.5, 2.5);
export const MORPH_OPEN_STRUCTURE_ELEMENT = cv.getStructuringElement(
	cv.MORPH_ELLIPSE,
	MORPH_OPEN_KERNEL_SIZE
);

// --- Constantes de Fiduciales ---
export const EXPECTED_FIDUCIAL_COUNT = 4;
export const FIDUCIAL_MIN_AREA_FACTOR = 0.001;
export const FIDUCIAL_MAX_AREA_FACTOR = 0.05;
export const FIDUCIAL_APPROX_EPSILON_FACTOR = 0.04;
export const FIDUCIAL_ASPECT_RATIO_TOLERANCE = 0.3;

// --- Constantes de Warp (Base Dimensions) ---
export const WARPED_IMAGE_WIDTH = 840; // Base width for percentage calculations
export const WARPED_IMAGE_HEIGHT = 1192; // Base height for percentage calculations
export const WARPED_SIZE = new cv.Size(WARPED_IMAGE_WIDTH, WARPED_IMAGE_HEIGHT);
export const WARP_BORDER_COLOR = new cv.Vec3(255, 255, 255); // Blanco

// --- Constantes de Layout Porcentuales ---
export const CODE_ROI_X_PERCENT = (232 / WARPED_IMAGE_WIDTH) * 100;
export const CODE_ROI_Y_PERCENT = (50 / WARPED_IMAGE_HEIGHT) * 100;
export const CODE_ROI_WIDTH_PERCENT = (341.3 / WARPED_IMAGE_WIDTH) * 100;
export const CODE_ROI_HEIGHT_PERCENT = (162.6 / WARPED_IMAGE_HEIGHT) * 100;

export const ANSWERS_GLOBAL_Y_START_PERCENT = (262.7 / WARPED_IMAGE_HEIGHT) * 100;
export const ANSWERS_MARGIN_LEFT_PERCENT = (21.7 / WARPED_IMAGE_WIDTH) * 100;
export const ANSWERS_MARGIN_RIGHT_PERCENT = (21.7 / WARPED_IMAGE_WIDTH) * 100;

export const BUBBLE_WIDTH_PERCENT = (28.4 / WARPED_IMAGE_WIDTH) * 100;
export const BUBBLE_HEIGHT_PERCENT = (34.9 / WARPED_IMAGE_HEIGHT) * 100;
export const HORIZONTAL_SPACING_PERCENT = (6.7 / WARPED_IMAGE_WIDTH) * 100;
export const VERTICAL_SPACING_PERCENT = (7.2 / WARPED_IMAGE_HEIGHT) * 100;

export const HORIZONTAL_PITCH_PERCENT = BUBBLE_WIDTH_PERCENT + HORIZONTAL_SPACING_PERCENT;
export const VERTICAL_PITCH_PERCENT = BUBBLE_HEIGHT_PERCENT + VERTICAL_SPACING_PERCENT;

export const ANSWERS_GROUP_WIDTH_PERCENT = (168 / WARPED_IMAGE_WIDTH) * 100;
export const ANSWERS_INTER_GROUP_SPACING_PERCENT = (41.84 / WARPED_IMAGE_WIDTH) * 100;

// --- Constantes de Procesamiento de ROIs ---
export const BUBBLE_FILL_THRESHOLD_RATIO = 0.5;
export const BUBBLE_SAMPLE_AREA_RATIO = 0.6;
