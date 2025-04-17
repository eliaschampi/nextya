import type { ApiOmrErrorData, ApiOmrSuccessData } from './api';

export type FileStatus = 'pending' | 'processing' | 'success' | 'error';

export interface FileEntry {
	file: File;
	id: string; // Identificador único para la clave
	status: FileStatus;
	result: ApiOmrSuccessData | null;
	error: ApiOmrErrorData | null;
	saved: boolean;
}

// Extiende FileEntry para incluir la URL del objeto gestionada
export interface FileEntryWithUrl extends FileEntry {
	objectUrl?: string; // URL creada con URL.createObjectURL
}
