// src/lib/csvProcessor/types.ts

/**
 * CSV processor specific error codes
 * More granular than ApiErrorCode for internal use
 */
export enum CsvProcessorErrorCode {
	// Parsing errors
	PARSE_ERROR = 'PARSE_ERROR',
	ENCODING_ERROR = 'ENCODING_ERROR',

	// Validation errors
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
	INVALID_FORMAT = 'INVALID_FORMAT',
	INVALID_VALUE = 'INVALID_VALUE',

	// Duplicate errors
	DUPLICATE_ROLL_CODE = 'DUPLICATE_ROLL_CODE',
	DUPLICATE_NAME = 'DUPLICATE_NAME',
	DUPLICATE_IN_DATABASE = 'DUPLICATE_IN_DATABASE',

	// Database errors
	DB_ERROR = 'DB_ERROR',
	DB_CONSTRAINT_ERROR = 'DB_CONSTRAINT_ERROR',

	// General errors
	UNEXPECTED_ERROR = 'UNEXPECTED_ERROR'
}

/** Represents the raw row object parsed directly from CSV with headers: true */
export interface CsvInputRow {
	name?: string;
	last_name?: string;
	phone?: string;
	email?: string;
	group_name?: string;
	roll_code?: string;
	[key: string]: string | undefined;
}

/** Represents a validated student record ready for API commit. */
export type StudentRegisterData = {
	name: string;
	last_name: string;
	phone: string | null;
	email: string | null;
	group_name: string;
	roll_code: string;
};

/** Structure detailing a specific validation error */
export interface ValidationErrorDetail {
	field: keyof CsvInputRow | 'file'; // Field name or 'file' for general errors
	message: string;
	code: CsvProcessorErrorCode; // Added error code for more structured error handling
}

/** Detailed information about a row that was omitted from the valid results. */
export interface OmittedRowDetail {
	/** The original row data (as parsed) that caused the omission. */
	row: CsvInputRow;
	/** The original 1-based line number in the file. */
	rowNumber: number;
	/** Specific reason for omission (validation errors or duplicate). */
	reason: string;
	/** Error code for programmatic handling */
	code: CsvProcessorErrorCode;
	/** Structured validation errors, if applicable. */
	errors?: ValidationErrorDetail[];
}

/** The final structured result of the import process. */
export interface ImportResult {
	validRows: StudentRegisterData[];
	omittedRows: OmittedRowDetail[];
}

/** Detailed error information for commit operations */
export interface CommitErrorDetail {
	row: StudentRegisterData;
	error: string;
	code: CsvProcessorErrorCode;
}

/** Detailed information about existing students */
export interface ExistingStudentDetail {
	row: StudentRegisterData;
	studentCode: string;
	studentName?: string;
}

/** Commit result structure for database operations */
export interface CommitResult {
	inserted: number;
	errors: CommitErrorDetail[];
	duplicates: CommitErrorDetail[];
	existingStudents: ExistingStudentDetail[];
	/** Summary statistics for UI display */
	summary?: {
		totalProcessed: number;
		successRate: number;
	};
}

/** Generic type for data rows intended for CSV export */
export type ExportDataRow = Record<string, unknown>;
