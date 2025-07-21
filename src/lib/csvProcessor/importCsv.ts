// src/lib/csvProcessor/importCsv.ts
import { parseString, type ParserOptionsArgs } from 'fast-csv';
import type {
	ImportResult,
	StudentRegisterData,
	OmittedRowDetail,
	CsvInputRow,
	ValidationErrorDetail
} from './types';
import { CsvProcessorErrorCode } from './types';

// Constantes para validaciones
const ALLOWED_GROUP_NAMES: ReadonlyArray<string> = ['A', 'B', 'C', 'D']; // Must match database constraint
const ROLL_CODE_REGEX: Readonly<RegExp> = /^\d{4}$/;
const EMAIL_REGEX: Readonly<RegExp> = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PARSE_OPTIONS: ParserOptionsArgs = {
	headers: true, // Interpreta la primera fila como cabeceras
	delimiter: ',', // Delimitador de campos
	ignoreEmpty: true, // Ignora filas completamente vacías
	trim: true // Elimina espacios en blanco al inicio y fin de los campos
};

/**
 * Crea una clave única para nombre + apellido (insensible a mayúsculas)
 * Utilizada para detectar duplicados por nombre
 * @param name - Nombre del estudiante
 * @param lastName - Apellido del estudiante
 * @returns Clave única normalizada para comparaciones
 */
export function createNameKey(name: string, lastName: string): string {
	// Normaliza y elimina espacios extra, acentos, etc.
	const normalizedName = name?.trim()?.toLowerCase() ?? '';
	const normalizedLastName = lastName?.trim()?.toLowerCase() ?? '';
	return `${normalizedName}||${normalizedLastName}`;
}

/** Verifica si una cadena tiene un formato de email válido */
function isValidEmailFormat(email: string): boolean {
	return EMAIL_REGEX.test(email);
}

/**
 * Valida una fila del CSV.
 * @param row - La fila parseada del CSV.
 * @returns Un array de errores de validación o null si la fila es válida.
 */
function validateRow(row: CsvInputRow): ValidationErrorDetail[] | null {
	const errors: ValidationErrorDetail[] = [];
	// Normalizar y obtener valores, usando '' como default para campos requeridos
	const name = row.name?.trim() ?? '';
	const lastName = row.last_name?.trim() ?? '';
	const rollCode = row.roll_code?.trim() ?? '';
	const groupName = row.group_name?.trim() ?? '';
	const email = row.email?.trim() || null; // Email es opcional

	// Validaciones de campos requeridos
	if (!name)
		errors.push({
			field: 'name',
			message: 'Campo requerido',
			code: CsvProcessorErrorCode.MISSING_REQUIRED_FIELD
		});
	if (!lastName)
		errors.push({
			field: 'last_name',
			message: 'Campo requerido',
			code: CsvProcessorErrorCode.MISSING_REQUIRED_FIELD
		});
	if (!rollCode)
		errors.push({
			field: 'roll_code',
			message: 'Campo requerido',
			code: CsvProcessorErrorCode.MISSING_REQUIRED_FIELD
		});
	if (!groupName)
		errors.push({
			field: 'group_name',
			message: 'Campo requerido',
			code: CsvProcessorErrorCode.MISSING_REQUIRED_FIELD
		});

	// Validaciones de formato y valores permitidos
	if (rollCode && !ROLL_CODE_REGEX.test(rollCode)) {
		errors.push({
			field: 'roll_code',
			message: `Debe tener 4 dígitos (valor: '${rollCode}')`,
			code: CsvProcessorErrorCode.INVALID_FORMAT
		});
	}
	if (groupName && !ALLOWED_GROUP_NAMES.includes(groupName)) {
		errors.push({
			field: 'group_name',
			message: `Debe ser uno de [${ALLOWED_GROUP_NAMES.join(', ')}] (valor: '${groupName}')`,
			code: CsvProcessorErrorCode.INVALID_VALUE
		});
	}
	// Validar email solo si se proporcionó
	if (email && !isValidEmailFormat(email)) {
		errors.push({
			field: 'email',
			message: `Formato inválido (valor: '${email}')`,
			code: CsvProcessorErrorCode.INVALID_FORMAT
		});
	}

	return errors.length > 0 ? errors : null;
}

/**
 * Procesa un texto CSV para importar datos de estudiantes.
 * Valida cada fila y detecta duplicados de 'roll_code' y 'name' + 'last_name' dentro del archivo.
 *
 * @param csvText - El contenido del archivo CSV como texto.
 * @returns Una promesa que resuelve con el resultado de la importación (filas válidas y omitidas).
 */
export function importCsv(csvText: string): Promise<ImportResult> {
	return new Promise((resolve, reject) => {
		const validRows: StudentRegisterData[] = [];
		const omittedRows: OmittedRowDetail[] = [];
		const seenRollCodes = new Set<string>();
		// Usamos un Set para detectar nombres y apellidos duplicados (insensible a mayúsculas)
		const seenNames = new Set<string>();
		let rowNumber = 1; // Contador para número de línea (base 1)

		try {
			// Usamos directamente el texto CSV proporcionado
			parseString(csvText, PARSE_OPTIONS)
				.on('error', (error: Error) => {
					// Rechaza la promesa si hay un error de parseo
					reject(new Error(`Error al parsear CSV: ${error.message}`));
				})
				.on('data', (rawRow: CsvInputRow) => {
					const currentLineNumber = rowNumber++; // Línea actual antes de procesar
					const validationErrors = validateRow(rawRow);

					// Si hay errores de validación, omitir la fila
					if (validationErrors) {
						omittedRows.push({
							row: rawRow,
							rowNumber: currentLineNumber,
							reason: `Error(es) de validación: ${validationErrors
								.map((e) => `${e.field}: ${e.message}`)
								.join('; ')}`,
							code: CsvProcessorErrorCode.VALIDATION_ERROR,
							errors: validationErrors
						});
						return; // Pasar a la siguiente fila
					}

					// Construir el objeto de datos validado (asegurando que los campos requeridos existen)
					// Los ! son seguros aquí debido a la validación previa
					const validData: StudentRegisterData = {
						name: rawRow.name!.trim(),
						last_name: rawRow.last_name!.trim(),
						phone: rawRow.phone?.trim() || null,
						email: rawRow.email?.trim() || null,
						group_name: rawRow.group_name!.trim(),
						roll_code: rawRow.roll_code!.trim()
					};

					// Comprobar duplicados dentro del archivo
					let isDuplicate = false;
					let duplicateReason = '';
					let duplicateCode = CsvProcessorErrorCode.UNEXPECTED_ERROR;

					// Crear una clave única para nombre + apellido (insensible a mayúsculas)
					const nameKey = createNameKey(validData.name, validData.last_name);

					if (seenRollCodes.has(validData.roll_code)) {
						isDuplicate = true;
						duplicateReason = `Duplicado: código '${validData.roll_code}' ya existe en este archivo.`;
						duplicateCode = CsvProcessorErrorCode.DUPLICATE_ROLL_CODE;
					} else if (seenNames.has(nameKey)) {
						isDuplicate = true;
						duplicateReason = `Duplicado: nombre '${validData.name} ${validData.last_name}' ya existe en este archivo.`;
						duplicateCode = CsvProcessorErrorCode.DUPLICATE_NAME;
					}

					// Si es duplicado, omitir la fila
					if (isDuplicate) {
						omittedRows.push({
							row: rawRow,
							rowNumber: currentLineNumber,
							reason: duplicateReason,
							code: duplicateCode
						});
					} else {
						// Si no es duplicado, añadir a vistos y a filas válidas
						seenRollCodes.add(validData.roll_code);
						seenNames.add(nameKey);
						validRows.push(validData);
					}
				})
				.on('end', (rowCount: number) => {
					// Resuelve la promesa al finalizar el parseo
					console.log(`Parsed ${rowCount} rows`);
					resolve({ validRows, omittedRows });
				});
		} catch (error) {
			// Captura errores en la configuración inicial
			const message = error instanceof Error ? error.message : String(error);
			reject(new Error(`Error al iniciar procesamiento CSV: ${message}`));
		}
	});
}
