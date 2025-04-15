import type { AnswerValue } from '$lib/omrProcessor';

// Types for OMR processing results
export interface OmrProcessedResult {
	status: 'success' | 'error';
	detectedCode?: string;
	studentCode?: string;
	errorType?: string;
	message?: string;
	student?: {
		name: string;
		lastName: string;
		rollCode: string;
		registerCode: string;
	};
	validationStatus?: {
		isValid: boolean;
		message: string;
	};
	results?: {
		correctCount: number;
		incorrectCount: number;
		blankCount: number;
		totalScore: number;
	};
	answers?: Record<number, AnswerValue>;
	questions?: unknown[];
	omrResult?: unknown;
	saved?: boolean; // Flag to indicate if the result has been saved
}
