// src/lib/csvProcessor/index.ts

export { importCsv, createNameKey } from './importCsv';
export {
	generateExcelCsv,
	createExportFilename,
	formatResultsForExport,
	getResultsExportHeaders,
	fetchEvaluationData,
	fetchEvaluationResults,
	createCsvResponse,
	exportEvaluationResultsToCsv
} from './exportExcel';

// Student export functions
export {
	fetchStudentEvalReports,
	formatStudentReportsForExport,
	getStudentReportHeaders,
	createStudentExportFilename,
	exportStudentEvaluationsToCsv
} from './studentExport';

// Evaluation detailed export functions
export {
	fetchEvalDetailedResults,
	formatEvalDetailedForExport,
	getEvalDetailedHeaders,
	createEvalDetailedExportFilename,
	exportEvalDetailedToCsv
} from './evalDetailedExport';
export { CsvProcessorErrorCode } from './types';

export type {
	ImportResult,
	StudentRegisterData,
	OmittedRowDetail,
	ValidationErrorDetail,
	ExportDataRow,
	CsvInputRow,
	CommitResult,
	CommitErrorDetail,
	ExistingStudentDetail
} from './types';

// Export types from studentExport
export type {
	StudentEvalReport,
	StudentExportRow,
	EvalDetailedResult,
	EvalDetailedExportRow
} from '$lib/types/studentExport';
