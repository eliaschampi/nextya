// omrProcessor/index.ts

// Exporta la función principal del orquestador
export { omrProcessorInternal as omrProcessor } from './omrProcessor';

// Re-exporta los tipos necesarios para el consumidor del módulo
export type {
	OmrResult,
	OmrSuccessResult,
	OmrErrorResult,
	OmrErrorCode,
	AnswerValue
} from './types';

// Opcionalmente, podrías exportar la clase OmrError si quieres
// permitir a los consumidores hacer `instanceof OmrError`
// export { OmrError } from './error';
