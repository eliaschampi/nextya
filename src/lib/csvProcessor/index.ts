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
