import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { omrProcessor as processOmrImage } from '$lib/omrProcessor';
import { fetchRegisterByStudentCode } from '$lib/data/register';
import { fetchQuestions } from '$lib/data/question';
import type { EvalQuestion } from '../../../../app';

// Función auxiliar para obtener las preguntas de evaluación
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { imageData, evalData, rollCode = null, questions = null } = await request.json();

		if (!imageData || !evalData.code) {
			return json({ status: 'error', message: 'Argumentos faltantes' }, { status: 400 });
		}

		let questionsData: EvalQuestion[] = [];
		const evalCode = evalData.code;

		if (questions && Array.isArray(questions) && questions.length > 0) {
			questionsData = questions;
		} else {
			questionsData = await fetchQuestions(evalCode, locals.supabase);
		}

		// Convertir la imagen de base64 a buffer
		const numQuestions = questionsData.length;
		const buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

		// Procesar la imagen OMR
		const omrResult = await processOmrImage(buffer, numQuestions, true);
		if (omrResult.status === 'error') {
			return json(omrResult);
		}

		// Usar el rollCode proporcionado o el detectado por el procesamiento
		const studentRollCode = rollCode || omrResult.studentCode;

		// Validar que el rollCode tenga 4 dígitos
		if (!/^\d{4}$/.test(studentRollCode)) {
			return json(
				{
					status: 'error',
					errorType: 'invalid_roll_code',
					message: `Código inválido: ${studentRollCode}.`,
					detectedCode: omrResult.studentCode,
					omrResult
				},
				{ status: 400 }
			);
		}

		// obtener el estudiante por su código
		const studentInfo = await fetchRegisterByStudentCode(locals.supabase, studentRollCode);

		// Procesar las respuestas y evaluar resultados
		let correctCount = 0;
		let incorrectCount = 0;
		let blankCount = 0;
		let totalScore = 0;

		for (const question of questionsData) {
			const questionIndex = question.order_in_eval - 1;
			const studentAnswer = omrResult.answers[questionIndex];
			if (!studentAnswer || studentAnswer === null) {
				blankCount++;
			} else if (studentAnswer === 'error_multiple') {
				incorrectCount++;
			} else if (studentAnswer.toUpperCase() === question.correct_key) {
				correctCount++;
				totalScore += Number(question.score_percent);
			} else {
				incorrectCount++;
			}
		}

		return json({
			status: 'success',
			detectedCode: omrResult.studentCode,
			studentCode: studentRollCode,
			student: studentInfo,
			validationStatus: {
				isValid: studentInfo !== null,
				message:
					studentInfo === null
						? `No se encontró estudiante con código ${studentRollCode}`
						: 'Estudiante encontrado'
			},
			results: {
				correctCount,
				incorrectCount,
				blankCount,
				totalScore
			},
			answers: omrResult.answers,
			questions: questionsData
		});
	} catch (error) {
		console.error('OMR API error:', error);
		return json(
			{
				status: 'error',
				message: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};
