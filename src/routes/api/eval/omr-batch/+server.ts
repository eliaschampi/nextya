import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { omrProcessor } from '$lib/omrProcessor';
import { fetchRegisterByRollCode } from '$lib/data/register';
import { fetchSections } from '$lib/data/eval';
import { calculateScores } from '$lib/utils/scoring';
import type {
	ApiOmrBatchResponse,
	ApiOmrErrorData,
	ApiOmrSuccessData,
	OmrBatchItem
} from '$lib/types/api';
import { createErrorResult as createOmrErrorResultObject } from '$lib/omrProcessor/error';
import type { EvalQuestion, EvalSection } from '$lib/types';
import { fetchQuestions } from '$lib/data/question';

const DEBUG_OMR = false;

// Helper para validar request body
function createValidationError(message: string, status = 400) {
	return json(
		{
			success: false,
			error: { code: 'INVALID_PARAMS', message },
			results: []
		},
		{ status }
	);
}

// Helper para calcular tamaño de imagen base64
function getBase64ImageSize(imageData: string): number {
	const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
	return Math.ceil((base64Data.length * 3) / 4);
}

// Helper para crear respuestas de error estandarizadas para un item específico
function createItemErrorResponse(
	itemId: string,
	code: ApiOmrErrorData['code'],
	internalError?: unknown,
	rollCode?: string,
	debugImage?: string | null
): OmrBatchItem {
	// Mapeo de códigos a mensajes genéricos para el usuario
	const userMessages: Record<string, string> = {
		DECODE_FAILED: 'Error al leer la imagen. Intenta con una imagen más clara.',
		IMAGE_EMPTY: 'La imagen está vacía o no se pudo cargar.',
		PREPROCESSING_FAILED: 'Error al preparar la imagen para el análisis.',
		FIDUCIALS_NOT_FOUND: 'No se encontraron las marcas de guía en la hoja.',
		FIDUCIALS_INVALID_COUNT: 'Número incorrecto de marcas de guía detectadas.',
		FIDUCIAL_ORDERING_FAILED: 'No se pudo determinar la orientación de la hoja.',
		WARP_FAILED: 'Error al corregir la perspectiva de la imagen.',
		WARPED_IMAGE_EMPTY: 'La imagen corregida está vacía.',
		ROI_EXTRACTION_FAILED: 'No se pudieron extraer las áreas de interés.',
		CODE_ROI_EMPTY: 'El área del código está vacía.',
		ANSWERS_ROI_EMPTY: 'El área de respuestas está vacía.',
		BUBBLE_DETECTION_FAILED: 'Error al detectar las burbujas marcadas.',
		CODE_PROCESSING_FAILED: 'Error al leer el código de estudiante.',
		ANSWER_PROCESSING_FAILED: 'Error al leer las respuestas marcadas.',
		CALCULATION_ERROR: 'Error en cálculos internos.',
		INVALID_PARAMS: 'Parámetros inválidos para el procesamiento.',
		UNEXPECTED_ERROR: 'Ocurrió un error inesperado durante el procesamiento OMR.',
		VALIDATION_ERROR: 'El código del estudiante no es válido (debe tener 4 dígitos).',
		STUDENT_NOT_FOUND:
			'No se encontró un estudiante registrado con ese código o pertenece a otro grupo.',
		INTERNAL_ERROR: 'Ocurrió un error interno en el servidor.'
	};

	const errorPayload: ApiOmrErrorData = {
		code,
		message: userMessages[code] || userMessages['INTERNAL_ERROR'],
		roll_code: rollCode,
		omr_debug_image: debugImage
	};

	// Loggear el error interno detallado
	console.error(`[API OMR Batch Error] Item ID: ${itemId}, Code: ${code}, Details:`, internalError);

	return {
		id: itemId,
		success: false,
		error: errorPayload
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	// Define maximum allowed items per request to prevent DoS
	const MAX_ITEMS_PER_REQUEST = 20;
	const MAX_IMAGE_SIZE_BYTES = 1024 * 1024 * 2; // 2MB max per image

	let items: { id: string; imageData: string; rollCode?: string }[] = [];
	let evalCode: string;
	let evalGroupName: string;
	let evalLevelCode: string;
	let questions: EvalQuestion[] | null = null;
	let sections: EvalSection[] | null = null;

	try {
		const body = await request.json();

		// Validate required fields
		const requiredFields = ['items', 'evalCode', 'evalGroupName', 'evalLevelCode'];
		const missingField = requiredFields.find((field) => !body[field]);
		if (missingField || !Array.isArray(body.items)) {
			return createValidationError('Faltan campos requeridos');
		}

		// Validate items array size
		if (body.items.length > MAX_ITEMS_PER_REQUEST) {
			return createValidationError(`Máximo ${MAX_ITEMS_PER_REQUEST} elementos permitidos`);
		}

		// Validate each item structure and size
		const invalidItem = body.items.find((item: { id: string; imageData: string }) => {
			if (!item.id || typeof item.id !== 'string') return 'ID inválido';
			if (!item.imageData || typeof item.imageData !== 'string') return 'Imagen inválida';

			const sizeInBytes = getBase64ImageSize(item.imageData);
			if (sizeInBytes > MAX_IMAGE_SIZE_BYTES) {
				return `Imagen muy grande (máx ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB)`;
			}
			return null;
		});

		if (invalidItem) {
			return createValidationError(
				typeof invalidItem === 'string' ? invalidItem : 'Elemento inválido'
			);
		}

		// All validations passed, assign values
		items = body.items;
		evalCode = body.evalCode;
		evalGroupName = body.evalGroupName;
		evalLevelCode = body.evalLevelCode;
		questions = body.questions || null;
		sections = body.sections || null;
	} catch {
		return createValidationError('JSON inválido');
	}

	// 1. Obtener preguntas y secciones (una sola vez para todos los items)
	if (!questions?.length) {
		questions = await fetchQuestions(evalCode, locals.db);
		if (!questions?.length) {
			return createValidationError('Sin preguntas disponibles', 500);
		}
	}

	if (!sections?.length) {
		sections = await fetchSections(evalCode, locals.db);
		if (!sections?.length) {
			return createValidationError('Sin cursos disponibles', 500);
		}
	}

	const numQuestions = questions.length;
	const results: OmrBatchItem[] = [];

	// 2. Procesar cada item
	for (const item of items) {
		try {
			// Validar código proporcionado antes de procesar
			if (item.rollCode && !/^\d{4}$/.test(item.rollCode)) {
				results.push(
					createItemErrorResponse(
						item.id,
						'VALIDATION_ERROR',
						`Invalid provided roll code: ${item.rollCode}. Must be 4 digits.`,
						item.rollCode
					)
				);
				continue;
			}

			// Procesar imagen OMR
			let omrResult;
			let debugImage: string | null = null;
			try {
				const buffer = Buffer.from(
					item.imageData.replace(/^data:image\/\w+;base64,/, ''),
					'base64'
				);
				omrResult = await omrProcessor(buffer, numQuestions, DEBUG_OMR, item.rollCode || null);
				if (omrResult.debug) {
					debugImage = null; // TODO: Implementar
				}
			} catch (error) {
				console.error(`Error calling omrProcessor for item ${item.id}:`, error);
				const omrError = createOmrErrorResultObject(error);
				results.push(
					createItemErrorResponse(
						item.id,
						omrError.errorCode,
						error,
						item.rollCode || undefined,
						omrError.debug?.processedImage
					)
				);
				continue;
			}

			// Si el OMR falló internamente y devolvió un error estructurado
			if (omrResult.status === 'error') {
				results.push(
					createItemErrorResponse(
						item.id,
						omrResult.errorCode,
						omrResult.message,
						item.rollCode || undefined,
						omrResult.debug?.processedImage
					)
				);
				continue;
			}

			// 3. Validar y determinar código final
			const finalRollCode = item.rollCode || omrResult.studentCode;

			// 4. Obtener Información del Registro del Estudiante
			const registerInfo = await fetchRegisterByRollCode(
				locals.db,
				finalRollCode,
				evalGroupName,
				evalLevelCode
			);

			// 5. Calcular Puntajes
			const { detailedAnswers, scores } = calculateScores(omrResult.answers, sections, questions);

			// 6. Construir Respuesta Exitosa para este item
			const successData: ApiOmrSuccessData = {
				roll_code: finalRollCode,
				register_code: registerInfo?.register_code || '', // Vacío si no se encontró
				student: registerInfo?.student || null,
				answers: detailedAnswers,
				scores: scores,
				omr_debug_image: debugImage
			};

			results.push({
				id: item.id,
				success: true,
				data: successData
			});
		} catch (error) {
			// Capturar cualquier error no manejado
			results.push(createItemErrorResponse(item.id, 'UNEXPECTED_ERROR', error));
		}
	}

	// 7. Construir respuesta final
	const response: ApiOmrBatchResponse = {
		success: true,
		results
	};

	return json(response);
};
