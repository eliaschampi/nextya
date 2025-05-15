// src/lib/csvProcessor/studentExport.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentEvalReport, StudentExportRow } from '$lib/types';
import { generateExcelCsv, createCsvResponse } from './exportExcel';

/**
 * Obtiene los datos de evaluaciones de un estudiante desde Supabase
 *
 * @param supabase - Cliente de Supabase
 * @param studentCode - Código del estudiante
 * @returns Datos de evaluaciones del estudiante o null si hay error
 */
export async function fetchStudentEvalReports(
	supabase: SupabaseClient,
	studentCode: string
): Promise<StudentEvalReport[] | null> {
	const { data, error } = await supabase.rpc('get_student_eval_report', {
		p_student_code: studentCode
	});

	if (error) {
		console.error('Error fetching student evaluation reports:', error);
		return null;
	}

	// Transform the data to ensure all fields have the correct types
	return data.map(
		(item: {
			eval_name: string;
			eval_code: string;
			eval_date: string;
			general_score: number;
			register_code: string;
			result_code: string;
			course_scores: string | Record<string, number>;
		}) => ({
			...item,
			eval_code: String(item.eval_code),
			register_code: String(item.register_code),
			result_code: String(item.result_code),
			course_scores:
				typeof item.course_scores === 'string' ? JSON.parse(item.course_scores) : item.course_scores
		})
	);
}

/**
 * Formatea los datos de evaluaciones de estudiante para exportación a Excel/CSV
 * Crea un formato con columnas dinámicas para los cursos
 *
 * @param reports - Array de reportes de evaluaciones a formatear
 * @returns Array de objetos formateados para exportación y conjunto de todos los cursos encontrados
 */
export function formatStudentReportsForExport(reports: StudentEvalReport[]): {
	exportData: StudentExportRow[];
	allCourses: string[];
} {
	// Extraer todos los nombres de cursos únicos de todos los reportes
	const allCoursesSet = new Set<string>();

	reports.forEach((report) => {
		if (report.course_scores) {
			Object.keys(report.course_scores).forEach((courseName) => {
				allCoursesSet.add(courseName);
			});
		}
	});

	// Convertir el Set a un array ordenado alfabéticamente
	const allCourses = Array.from(allCoursesSet).sort();

	// Formatear los datos para exportación
	const exportData = reports.map((report) => {
		// Crear el objeto base con las columnas fijas
		const row: StudentExportRow = {
			'Nombre Examen': report.eval_name,
			Fecha: new Date(report.eval_date).toLocaleDateString('es-ES'),
			'Nota General': Number(report.general_score.toFixed(2))
		};

		// Añadir columnas dinámicas para cada curso
		allCourses.forEach((courseName) => {
			const courseScore = report.course_scores[courseName];
			row[`${courseName}`] = courseScore ? Number(courseScore.toFixed(2)) : '';
		});

		return row;
	});

	return { exportData, allCourses };
}

/**
 * Obtiene los encabezados para la exportación de evaluaciones de estudiante
 * Incluye encabezados dinámicos para los cursos
 *
 * @param allCourses - Array con todos los nombres de cursos a incluir
 * @returns Array de encabezados para la exportación
 */
export function getStudentReportHeaders(allCourses: string[]): string[] {
	// Encabezados fijos
	const fixedHeaders = ['Nombre Examen', 'Fecha', 'Nota General'];

	// Añadir encabezados dinámicos para cada curso
	const courseHeaders = allCourses.map((courseName) => `${courseName}`);

	return [...fixedHeaders, ...courseHeaders];
}

/**
 * Crea un nombre de archivo para la exportación de evaluaciones de estudiante
 *
 * @param studentName - Nombre del estudiante
 * @param studentLastName - Apellido del estudiante
 * @returns Nombre de archivo sanitizado
 */
export function createStudentExportFilename(studentName: string, studentLastName: string): string {
	// Formatear la fecha actual
	const date = new Date();
	const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
		2,
		'0'
	)}-${String(date.getDate()).padStart(2, '0')}`;

	// Sanitizar nombres
	const sanitizedName = studentName
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/\s+/g, '_');

	const sanitizedLastName = studentLastName
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/\s+/g, '_');

	return `constancia_${sanitizedName}_${sanitizedLastName}_${formattedDate}.csv`;
}

/**
 * Proceso completo de exportación de evaluaciones de estudiante a CSV
 *
 * @param supabase - Cliente de Supabase
 * @param studentCode - Código del estudiante
 * @param studentName - Nombre del estudiante
 * @param studentLastName - Apellido del estudiante
 * @returns Objeto Response con el CSV o null si hay error
 */
export async function exportStudentEvaluationsToCsv(
	supabase: SupabaseClient,
	studentCode: string,
	studentName: string,
	studentLastName: string
): Promise<Response | null> {
	// Obtener datos de evaluaciones del estudiante
	const reportsData = await fetchStudentEvalReports(supabase, studentCode);
	if (!reportsData || reportsData.length === 0) return null;

	// Formatear datos para exportación
	const { exportData, allCourses } = formatStudentReportsForExport(reportsData);

	// Obtener encabezados
	const headers = getStudentReportHeaders(allCourses);

	// Crear nombre de archivo
	const filename = createStudentExportFilename(studentName, studentLastName);

	// Generar contenido CSV
	const csvContent = await generateExcelCsv(exportData, headers);

	// Crear respuesta HTTP
	return createCsvResponse(csvContent, filename);
}
