// src/lib/csvProcessor/importCsv.ts
import { parseString, type ParserOptionsArgs } from 'fast-csv';
import type {
	ImportResult,
	StudentRegisterData,
	OmittedRowDetail,
	CsvInputRow,
	ValidationErrorDetail
} from './types';

const ALLOWED_GROUP_NAMES = ['A', 'B', 'C', 'D', 'E'];
const ROLL_CODE_REGEX = /^\d{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PARSE_OPTIONS: ParserOptionsArgs = {
	headers: true,
	delimiter: ',',
	ignoreEmpty: true,
	trim: true
};

function isValidEmailFormat(email: string): boolean {
	return EMAIL_REGEX.test(email);
}

/** Validates row, returning structured errors or null */
function validateRow(row: CsvInputRow): ValidationErrorDetail[] | null {
	const errors: ValidationErrorDetail[] = [];
	const name = row.name?.trim() ?? '';
	const lastName = row.last_name?.trim() ?? '';
	const rollCode = row.roll_code?.trim() ?? '';
	const groupName = row.group_name?.trim() ?? '';
	const email = row.email?.trim() || null;

	if (!name) errors.push({ field: 'name', message: 'Missing required field' });
	if (!lastName) errors.push({ field: 'last_name', message: 'Missing required field' });
	if (!rollCode) errors.push({ field: 'roll_code', message: 'Missing required field' });
	if (!groupName) errors.push({ field: 'group_name', message: 'Missing required field' });

	if (rollCode && !ROLL_CODE_REGEX.test(rollCode)) {
		errors.push({ field: 'roll_code', message: `Must be exactly 4 digits (got '${rollCode}')` });
	}
	if (groupName && !ALLOWED_GROUP_NAMES.includes(groupName)) {
		errors.push({
			field: 'group_name',
			message: `Must be one of [${ALLOWED_GROUP_NAMES.join(', ')}] (got '${groupName}')`
		});
	}
	if (email && !isValidEmailFormat(email)) {
		errors.push({ field: 'email', message: `Invalid email format (got '${email}')` });
	}

	return errors.length > 0 ? errors : null;
}

export function importCsv(csvBuffer: Buffer): Promise<ImportResult> {
	return new Promise((resolve, reject) => {
		const validRows: StudentRegisterData[] = [];
		const omittedRows: OmittedRowDetail[] = [];
		const seenRollCodes = new Set<string>();
		const seenEmails = new Set<string>();
		let rowNumber = 1; // For 1-based line number reporting

		try {
			// fast-csv needs a string or stream, convert Buffer assuming UTF-8
			const csvString = csvBuffer.toString('utf-8');

			parseString(csvString, PARSE_OPTIONS)
				.on('error', (error: Error) => {
					reject(new Error(`CSV parsing failed: ${error.message}`));
				})
				.on('data', (rawRow: CsvInputRow) => {
					const currentLineNumber = rowNumber++;
					const validationErrors = validateRow(rawRow);

					if (validationErrors) {
						omittedRows.push({
							row: rawRow,
							rowNumber: currentLineNumber,
							reason: `Validation Error(s): ${validationErrors.map((e) => `${e.field}: ${e.message}`).join('; ')}`,
							errors: validationErrors
						});
						return;
					}

					const validData: StudentRegisterData = {
						name: rawRow.name!.trim(),
						last_name: rawRow.last_name!.trim(),
						phone: rawRow.phone?.trim() || null,
						email: rawRow.email?.trim() || null,
						group_name: rawRow.group_name!.trim(),
						roll_code: rawRow.roll_code!.trim()
					};

					let isDuplicate = false;
					let duplicateReason = '';

					if (validData.roll_code && seenRollCodes.has(validData.roll_code)) {
						isDuplicate = true;
						duplicateReason = `Duplicate: roll_code '${validData.roll_code}' already seen in this file.`;
					} else if (validData.email && seenEmails.has(validData.email)) {
						isDuplicate = true;
						duplicateReason = `Duplicate: email '${validData.email}' already seen in this file.`;
					}

					if (isDuplicate) {
						omittedRows.push({
							row: rawRow,
							rowNumber: currentLineNumber,
							reason: duplicateReason
						});
					} else {
						if (validData.roll_code) seenRollCodes.add(validData.roll_code);
						if (validData.email) seenEmails.add(validData.email);
						validRows.push(validData);
					}
				})
				.on('end', () => {
					// Resolve the promise when parsing is complete
					resolve({ validRows, omittedRows });
				});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			reject(new Error(`CSV processing setup failed: ${message}`));
		}
	});
}
