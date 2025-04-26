// src/lib/csvProcessor/exportCsv.ts
import { writeToString, type FormatterOptionsArgs } from 'fast-csv';
import type { ExportDataRow } from './types';

/**
 * Asynchronously formats an array of data objects into a CSV string, returned as a Buffer.
 *
 * @param dataRows - Array of data objects (Record<string, unknown>) to export.
 * @param headers - Optional. Array of strings for header names and order. Recommended.
 * @param options - Optional. Additional fast-csv FormatterOptionsArgs.
 * @returns A Promise resolving to a Buffer containing the UTF-8 encoded CSV content.
 */
export async function exportCsv(
	dataRows: ExportDataRow[],
	headers?: string[],
	options?: Omit<FormatterOptionsArgs<ExportDataRow, ExportDataRow>, 'headers' | 'writeHeaders'>
): Promise<Buffer> {
	if (!Array.isArray(dataRows)) {
		throw new Error('Input data must be an array of objects.');
	}

	// Determine effective headers: provided explicitly or infer (true)
	const effectiveHeaders = headers ?? true;

	// Handle edge case: empty data and no explicit headers to infer from
	if (dataRows.length === 0 && effectiveHeaders === true) {
		// Cannot infer headers, return empty buffer
		return Buffer.from('');
	}

	const formatOptions: FormatterOptionsArgs<ExportDataRow, ExportDataRow> = {
		delimiter: ',',
		rowDelimiter: '\n',
		includeEndRowDelimiter: true,
		quoteColumns: true,
		quoteHeaders: true,
		...options, // User overrides first
		headers: effectiveHeaders, // Use determined headers
		writeHeaders: true // Always write for export
	};

	try {
		// Let writeToString handle header generation if headers === true
		const csvString = await writeToString(dataRows, formatOptions);
		return Buffer.from(csvString, 'utf-8');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to generate CSV: ${message}`);
	}
}
