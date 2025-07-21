// src/lib/csvProcessor/evalDetailedExport.ts
import type { Database } from '$lib/database';
import { sql } from 'kysely';
import type { EvalDetailedResult, EvalDetailedExportRow } from '$lib/types/studentExport';
import { generateExcelCsv, createCsvResponse } from './exportExcel';

/**
 * Obtiene los datos detallados de una evaluación desde la base de datos
 *
 * @param evalCode - Código de la evaluación
 * @returns Datos detallados de la evaluación o null si hay error
 */
export async function fetchEvalDetailedResults(
	db: Database,
	evalCode: string
): Promise<EvalDetailedResult[] | null> {
	try {
		// Call the optimized SQL function using raw SQL
		const result = await sql<{
			roll_code: string;
			name: string;
			last_name: string;
			group_name: string;
			general_score: string; // NUMERIC comes as string from database
			course_scores: string | Record<string, number>;
		}>`SELECT * FROM get_eval_detailed_results(${evalCode})`.execute(db);

		if (!result.rows || result.rows.length === 0) {
			return null;
		}

		// Transform the data to ensure all fields have the correct types
		return result.rows.map((item) => ({
			...item,
			general_score: Number(item.general_score || 0),
			course_scores:
				typeof item.course_scores === 'string' ? JSON.parse(item.course_scores) : item.course_scores
		}));
	} catch (error) {
		console.error('Error fetching evaluation detailed results:', error);
		return null;
	}
}

/**
 * Formatea los datos detallados de evaluación para exportación a Excel/CSV
 * Crea un formato con columnas dinámicas para los cursos
 *
 * @param results - Array de resultados detallados a formatear
 * @returns Array de objetos formateados para exportación y conjunto de todos los cursos encontrados
 */
export function formatEvalDetailedForExport(results: EvalDetailedResult[]): {
	exportData: EvalDetailedExportRow[];
	allCourses: string[];
} {
	// Extraer todos los nombres de cursos únicos de todos los resultados
	const allCoursesSet = new Set<string>();

	results.forEach((result) => {
		if (result.course_scores) {
			Object.keys(result.course_scores).forEach((courseName) => {
				allCoursesSet.add(courseName);
			});
		}
	});

	// Convertir el Set a un array ordenado alfabéticamente
	const allCourses = Array.from(allCoursesSet).sort();

	// Formatear los datos para exportación
	const exportData = results.map((result) => {
		// Crear el objeto base con las columnas fijas
		const row: EvalDetailedExportRow = {
			Código: result.roll_code,
			Nombre: result.name,
			Apellidos: result.last_name,
			Grupo: result.group_name,
			'Nota General': Number(result.general_score.toFixed(2))
		};

		// Añadir columnas dinámicas para cada curso
		allCourses.forEach((courseName) => {
			const courseScore = result.course_scores[courseName];
			row[`${courseName}`] = courseScore ? Number(courseScore.toFixed(2)) : '';
		});

		return row;
	});

	return { exportData, allCourses };
}

/**
 * Obtiene los encabezados para el export detallado de evaluación
 *
 * @param allCourses - Array con todos los nombres de cursos
 * @returns Array de encabezados para el CSV
 */
export function getEvalDetailedHeaders(allCourses: string[]): string[] {
	const baseHeaders = ['Código', 'Nombre', 'Apellidos', 'Grupo', 'Nota General'];
	return [...baseHeaders, ...allCourses];
}

/**
 * Crea el nombre de archivo para el export detallado de evaluación
 *
 * @param evalName - Nombre de la evaluación
 * @param levelName - Nombre del nivel
 * @param evalDate - Fecha de la evaluación
 * @returns Nombre de archivo sanitizado
 */
export function createEvalDetailedExportFilename(
	evalName: string,
	levelName: string,
	evalDate: string
): string {
	// Format the date
	const date = new Date(evalDate);
	const formattedDate = date.toISOString().split('T')[0].replace(/-/g, '');

	// Sanitize the evaluation name
	const sanitizedEvalName = evalName
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/\s+/g, '_');

	const sanitizedLevelName = levelName
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/\s+/g, '_');

	return `resultados_detallado_${sanitizedLevelName}_${sanitizedEvalName}_${formattedDate}.csv`;
}

/**
 * Proceso completo de exportación detallada de evaluación a CSV
 *
 * @param evalCode - Código de la evaluación
 * @param evalName - Nombre de la evaluación
 * @param levelName - Nombre del nivel
 * @param evalDate - Fecha de la evaluación
 * @returns Objeto Response con el CSV o null si hay error
 */
export async function exportEvalDetailedToCsv(
	db: Database,
	evalCode: string,
	evalName: string,
	levelName: string,
	evalDate: string
): Promise<Response | null> {
	// Obtener datos detallados de la evaluación
	const resultsData = await fetchEvalDetailedResults(db, evalCode);
	if (!resultsData || resultsData.length === 0) return null;

	// Formatear datos para exportación
	const { exportData, allCourses } = formatEvalDetailedForExport(resultsData);

	// Obtener encabezados
	const headers = getEvalDetailedHeaders(allCourses);

	// Crear nombre de archivo
	const filename = createEvalDetailedExportFilename(evalName, levelName, evalDate);

	// Generar contenido CSV
	const csvContent = await generateExcelCsv(exportData, headers);

	// Crear respuesta HTTP
	return createCsvResponse(csvContent, filename);
}
