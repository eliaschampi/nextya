import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { omrProcessor } from '$lib/omrProcessor';
import { fetchRegisterByRollCode } from '$lib/data/register';
import { fetchEvalData } from '$lib/data/eval';
import { calculateScores } from '$lib/utils/scoring';
import type { ApiOmrResponse, ApiOmrErrorData, ApiOmrSuccessData } from '$lib/types/api';
import { createErrorResult as createOmrErrorResultObject } from '$lib/omrProcessor/error';

// Helper para crear respuestas de error estandarizadas
function createApiErrorResponse(
	code: ApiOmrErrorData['code'],
	internalError?: unknown, // Error original para logging
	rollCode?: string,
	debugImage?: string | null
): Response {
	// Mapeo de códigos a mensajes genéricos para el usuario
	const userMessages: Record<ApiOmrErrorData['code'], string> = {
		DECODE_FAILED: 'Error al leer la imagen. Intenta con una imagen más clara.',
		IMAGE_EMPTY: 'La imagen está vacía o no se pudo cargar.',
		PREPROCESSING_FAILED: 'Error al preparar la imagen para el análisis.',
		FIDUCIALS_NOT_FOUND: 'No se encontraron las marcas de guía en la hoja.',
		FIDUCIALS_INVALID_COUNT: 'Número incorrecto de marcas de guía detectadas.',
		FIDUCIAL_ORDERING_FAILED: 'Error al ordenar las marcas de guía.',
		WARP_FAILED: 'No se pudo alinear la hoja correctamente.',
		WARPED_IMAGE_EMPTY: 'Error interno al procesar la imagen alineada.',
		ROI_EXTRACTION_FAILED: 'Error al extraer las áreas de respuesta.',
		CODE_ROI_EMPTY: 'No se pudo encontrar el área del código de estudiante.',
		ANSWERS_ROI_EMPTY: 'No se pudo encontrar el área de respuestas.',
		BUBBLE_DETECTION_FAILED: 'Error al detectar las burbujas marcadas.',
		CODE_PROCESSING_FAILED: 'Error al leer el código del estudiante.',
		ANSWER_PROCESSING_FAILED: 'Error al leer las respuestas marcadas.',
		INVALID_PARAMS: 'Parámetros inválidos enviados al procesador.',
		CALCULATION_ERROR: 'Error en cálculos internos del procesador.',
		UNEXPECTED_ERROR: 'Ocurrió un error inesperado durante el procesamiento OMR.',
		VALIDATION_ERROR: 'El código del estudiante no es válido (debe tener 4 dígitos).',
		STUDENT_NOT_FOUND: 'No se encontró un estudiante registrado con ese código.',
		INTERNAL_ERROR: 'Ocurrió un error interno en el servidor.'
	};

	const errorPayload: ApiOmrErrorData = {
		code,
		message: userMessages[code] || userMessages['INTERNAL_ERROR'],
		roll_code: rollCode,
		omr_debug_image: debugImage
	};

	// Loggear el error interno detallado
	console.error(`[API OMR Error] Code: ${code}, Details:`, internalError);

	return json(
		{ success: false, error: errorPayload },
		{ status: code === 'VALIDATION_ERROR' || code === 'STUDENT_NOT_FOUND' ? 400 : 500 }
	);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	let imageDataBase64: string;
	let evalCode: string;
	let providedRollCode: string | null = null;

	try {
		const body = await request.json();
		imageDataBase64 = body.imageData;
		evalCode = body.evalCode; // Esperamos evalCode en lugar de evalData completo
		providedRollCode = body.rollCode || null; // Código opcional proporcionado por el usuario

		if (!imageDataBase64 || !evalCode) {
			return createApiErrorResponse('INVALID_PARAMS', 'Missing imageData or evalCode');
		}
	} catch {
		return createApiErrorResponse('INVALID_PARAMS', 'Invalid JSON body');
	}

	// 1. Obtener datos de la evaluación (preguntas y secciones)
	const evalData = await fetchEvalData(locals.supabase, evalCode);
	if (!evalData || !evalData.questions || evalData.questions.length === 0) {
		return createApiErrorResponse(
			'INTERNAL_ERROR',
			`Evaluation data not found for evalCode: ${evalCode}`
		);
	}
	const numQuestions = evalData.questions.length;

	// 2. Procesar imagen OMR
	let omrResult;
	let debugImage: string | null = null;
	try {
		const buffer = Buffer.from(imageDataBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
		// Pasa true para obtener imagen de debug si la librería lo soporta así
		omrResult = await omrProcessor(buffer, numQuestions, true);
		// Accede a la imagen de debug si existe
		if (omrResult.debug) {
			debugImage = null; // TODO: Implementar;
		}
	} catch (error) {
		console.error('Error calling omrProcessor:', error);
		// Intenta crear un OmrErrorResult para obtener el código y la imagen si es posible
		const omrError = createOmrErrorResultObject(error);
		return createApiErrorResponse(
			omrError.errorCode,
			error,
			providedRollCode || undefined,
			omrError.debug?.processedImage
		);
	}

	// Si el OMR falló internamente y devolvió un error estructurado
	if (omrResult.status === 'error') {
		return createApiErrorResponse(
			omrResult.errorCode,
			omrResult.message,
			providedRollCode || undefined,
			omrResult.debug?.processedImage
		);
	}

	// 3. Determinar y Validar Código del Estudiante (Roll Code)
	const detectedRollCode = omrResult.studentCode;
	const finalRollCode = providedRollCode || detectedRollCode; // Prioriza el código manual

	if (!finalRollCode || !/^\d{4}$/.test(finalRollCode)) {
		return createApiErrorResponse(
			'VALIDATION_ERROR',
			`Invalid roll code: ${finalRollCode}. Detected: ${detectedRollCode}, Provided: ${providedRollCode}`,
			finalRollCode, // Devolvemos el código que falló
			debugImage // Incluimos imagen de debug si existe
		);
	}

	// 4. Obtener Información del Registro del Estudiante
	const registerInfo = await fetchRegisterByRollCode(locals.supabase, finalRollCode);

	// 5. Calcular Puntajes
	const { detailedAnswers, scores } = calculateScores(omrResult.answers, evalData);

	// 6. Construir Respuesta Exitosa
	const successData: ApiOmrSuccessData = {
		roll_code: finalRollCode,
		register_code: registerInfo?.register_code || '', // Vacío si no se encontró
		student: registerInfo?.student || null,
		answers: detailedAnswers,
		scores: scores,
		omr_debug_image: debugImage // Incluir imagen de debug
	};

	const response: ApiOmrResponse = { success: true, data: successData };
	return json(response);
};
