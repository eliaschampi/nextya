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
