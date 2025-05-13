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
	let items: { id: string; imageData: string; rollCode?: string }[] = [];
	let evalCode: string;
	let evalGroupName: string;
	let evalLevelCode: string;
	let questions: EvalQuestion[] | null = null;
	let sections: EvalSection[] | null = null;

	try {
		const body = await request.json();
		items = body.items || [];
		evalCode = body.evalCode;
		evalGroupName = body.evalGroupName;
		evalLevelCode = body.evalLevelCode;
		questions = body.questions || null;
		sections = body.sections || null;

		if (!items.length || !evalCode || !evalGroupName) {
			return json(
				{
					success: false,
					error: {
						code: 'INVALID_PARAMS',
						message: 'Missing items, evalCode or evalGroupName'
					},
					results: []
				},
				{ status: 400 }
			);
		}
	} catch {
		return json(
			{
				success: false,
				error: {
					code: 'INVALID_PARAMS',
					message: 'Invalid JSON body'
				},
				results: []
			},
			{ status: 400 }
		);
	}

	// 1. Obtener preguntas y secciones (una sola vez para todos los items)
	if (!questions || !questions.length) {
		questions = await fetchQuestions(evalCode, locals.supabase);
	}
	if (!sections || !sections.length) {
		sections = await fetchSections(evalCode, locals.supabase);
	}

	if (!questions || !questions.length) {
		return json(
			{
				success: false,
				error: {
					code: 'INTERNAL_ERROR',
					message: 'No se ha obtenido nro de Respuestas.'
				},
				results: []
			},
			{ status: 500 }
		);
	}

	if (!sections || !sections.length) {
		return json(
			{
				success: false,
				error: {
					code: 'INTERNAL_ERROR',
					message: 'No hay cursos disponibles.'
				},
				results: []
			},
			{ status: 500 }
		);
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
				locals.supabase,
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
