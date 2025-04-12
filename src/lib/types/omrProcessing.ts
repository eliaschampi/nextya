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
	duplicateFound?: boolean;
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

// Types for saving results
export interface SaveResultRequest {
	evalCode: string;
	registerCode: string;
	answers: Record<number, AnswerValue>;
	correctCount: number;
	incorrectCount: number;
	blankCount: number;
	totalScore: number;
}

// Types for batch saving
export interface BatchSaveRequest {
	evalCode: string;
	results: SaveResultRequest[];
}

// Types for batch save response
export interface BatchSaveResponse {
	status: 'success' | 'error';
	message: string;
	processedResults?: Array<{
		registerCode: string;
		status: 'success' | 'error';
	}>;
	errors?: Array<{
		registerCode: string;
		message: string;
	}>;
}
