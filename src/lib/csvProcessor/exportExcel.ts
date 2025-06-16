// src/lib/csvProcessor/exportExcel.ts
import { writeToString } from 'fast-csv';
import { db } from '$lib/database';
import { sql } from 'kysely';
import type { ExportDataRow } from './types';
import type { ResultItem } from '$lib/types';

/**
 * Genera un string CSV optimizado para Excel con soporte para caracteres especiales
 *
 * @param dataRows - Array de objetos con los datos a exportar
 * @param headers - Array con los nombres de las columnas en el orden deseado
 * @returns String CSV con BOM para compatibilidad con Excel
 */
export async function generateExcelCsv(
	dataRows: ExportDataRow[],
	headers: string[]
): Promise<string> {
	if (!Array.isArray(dataRows)) {
		throw new Error('Los datos deben ser un array de objetos.');
	}

	if (dataRows.length === 0) {
		return '\uFEFF'; // Retornar solo BOM si no hay datos
	}

	// Generar CSV con opciones optimizadas para Excel
	const csvString = await writeToString(dataRows, {
		delimiter: ';', // Punto y coma para mejor compatibilidad con Excel
		rowDelimiter: '\r\n', // CRLF para compatibilidad con Windows
		headers: headers,
		writeHeaders: true,
		quoteColumns: false, // No poner comillas en todas las columnas
		quoteHeaders: false // No poner comillas en los encabezados
	});

	// Añadir BOM (Byte Order Mark) para que Excel reconozca UTF-8 correctamente
	return '\uFEFF' + csvString;
}

/**
 * Crea un nombre de archivo sanitizado para la exportación
 *
 * @param evalName - Nombre de la evaluación
 * @param levelName - Nombre del nivel
 * @param evalDate - Fecha de la evaluación (string ISO)
 * @returns Nombre de archivo sanitizado
 */
export function createExportFilename(
	evalName: string,
	levelName: string,
	evalDate: string
): string {
	// Formatear la fecha
	const date = new Date(evalDate);
	const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
		2,
		'0'
	)}-${String(date.getDate()).padStart(2, '0')}`;

	// Sanitizar nombres
	const sanitizedEvalName = evalName
		.replace(/[^\w\s-]/g, '') // Eliminar caracteres especiales
		.trim()
		.replace(/\s+/g, '_'); // Reemplazar espacios con guiones bajos

	const sanitizedLevelName = levelName
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/\s+/g, '_');

	return `resultados_${sanitizedLevelName}_${sanitizedEvalName}_${formattedDate}.csv`;
}

/**
 * Formatea los datos de resultados para exportación a Excel/CSV
 *
 * @param results - Array de resultados a formatear
 * @returns Array de objetos formateados para exportación
 */
export function formatResultsForExport(results: ResultItem[]): ExportDataRow[] {
	return results.map((result) => ({
		Código: result.roll_code,
		Nombre: result.name,
		Apellidos: result.last_name,
		Grupo: result.group_name,
		Correctas: result.correct_count,
		Incorrectas: result.incorrect_count,
		'En blanco': result.blank_count,
		Nota: result.score.toFixed(2)
	}));
}

/**
 * Obtiene los encabezados estándar para la exportación de resultados
 */
export function getResultsExportHeaders(): string[] {
	return [
		'Código',
		'Nombre',
		'Apellidos',
		'Grupo',
		'Correctas',
		'Incorrectas',
		'En blanco',
		'Nota'
	];
}

/**
 * Tipo para los datos de evaluación
 */
export interface EvaluationData {
	name: string;
	eval_date: string;
	levels:
		| {
				name: string;
		  }
		| Array<{ name: string }>;
}

/**
 * Obtiene los datos de evaluación desde la base de datos
 *
 * @param evalCode - Código de la evaluación
 * @returns Datos de la evaluación o null si hay error
 */
export async function fetchEvaluationData(evalCode: string): Promise<EvaluationData | null> {
	try {
		const data = await db
			.selectFrom('evals')
			.innerJoin('levels', 'levels.code', 'evals.levelCode')
			.select(['evals.name', 'evals.evalDate', 'levels.name as levelName'])
			.where('evals.code', '=', evalCode)
			.executeTakeFirst();

		if (!data) {
			console.error('Evaluation not found:', evalCode);
			return null;
		}

		return {
			name: data.name,
			eval_date: data.evalDate.toISOString(),
			levels: { name: data.levelName }
		} as EvaluationData;
	} catch (error) {
		console.error('Error fetching evaluation:', error);
		return null;
	}
}

/**
 * Obtiene los resultados de una evaluación desde la base de datos
 *
 * @param evalCode - Código de la evaluación
 * @returns Resultados de la evaluación o null si hay error
 */
export async function fetchEvaluationResults(evalCode: string) {
	try {
		const result = await sql`
			SELECT * FROM get_register_eval_results(${evalCode})
		`.execute(db);

		return result.rows;
	} catch (error) {
		console.error('Error fetching results:', error);
		return null;
	}
}

/**
 * Genera una respuesta HTTP con el contenido CSV para descarga
 *
 * @param csvContent - Contenido CSV con BOM
 * @param filename - Nombre del archivo
 * @returns Objeto Response para la API
 */
export function createCsvResponse(csvContent: string, filename: string): Response {
	return new Response(csvContent, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'no-cache'
		}
	});
}

/**
 * Proceso completo de exportación de resultados a CSV
 *
 * @param evalCode - Código de la evaluación
 * @returns Objeto Response con el CSV o null si hay error
 */
export async function exportEvaluationResultsToCsv(evalCode: string): Promise<Response | null> {
	// Obtener datos de la evaluación
	const evalData = await fetchEvaluationData(evalCode);
	if (!evalData) return null;

	// Obtener resultados
	const resultsData = await fetchEvaluationResults(evalCode);
	if (!resultsData) return null;

	// Formatear datos para exportación
	const exportData = formatResultsForExport(resultsData);

	// Obtener encabezados
	const headers = getResultsExportHeaders();

	// Extraer el nombre del nivel (levels puede ser un objeto o un array con un objeto)
	let levelName = 'nivel';
	if (evalData.levels) {
		// Si levels es un array, tomar el primer elemento
		if (Array.isArray(evalData.levels)) {
			levelName = evalData.levels[0]?.name || levelName;
		}
		// Si levels es un objeto con propiedad name
		else if (typeof evalData.levels === 'object' && evalData.levels.name) {
			levelName = evalData.levels.name;
		}
	}

	// Crear nombre de archivo
	const filename = createExportFilename(
		evalData.name || 'evaluacion',
		levelName,
		evalData.eval_date || new Date().toISOString()
	);

	// Generar contenido CSV
	const csvContent = await generateExcelCsv(exportData, headers);

	// Crear respuesta HTTP
	return createCsvResponse(csvContent, filename);
}
