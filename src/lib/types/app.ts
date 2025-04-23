import type { ApiOmrErrorData, ApiOmrSuccessData } from './api';

export type FileStatus = 'pending' | 'processing' | 'success' | 'error';

/**
 * Representa un archivo de imagen para procesamiento OMR
 */
export interface FileEntry {
	file: File;
	id: string; // Identificador único para la clave
	status: FileStatus;
	result: ApiOmrSuccessData | null;
	error: ApiOmrErrorData | null;
	saved: boolean;
	formatValid: boolean; // Indica si la imagen tiene proporción A5
	formatName: string; // Nombre del formato detectado (A5 Vertical, A5 Horizontal, etc.)
}
