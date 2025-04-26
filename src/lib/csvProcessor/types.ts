// src/lib/csvProcessor/types.ts

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
}

/** Detailed information about a row that was omitted from the valid results. */
export interface OmittedRowDetail {
	/** The original row data (as parsed) that caused the omission. */
	row: CsvInputRow;
	/** The original 1-based line number in the file. */
	rowNumber: number;
	/** Specific reason for omission (validation errors or duplicate). */
	reason: string;
	/** Structured validation errors, if applicable. */
	errors?: ValidationErrorDetail[];
}

/** The final structured result of the import process. */
export interface ImportResult {
	validRows: StudentRegisterData[];
	omittedRows: OmittedRowDetail[];
}

/** Generic type for data rows intended for CSV export */
export type ExportDataRow = Record<string, unknown>;
