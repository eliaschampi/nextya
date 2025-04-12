import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { omrProcessor as processOmrImage } from '$lib/omrProcessor';
import type { AnswerValue } from '$lib/omrProcessor';
import type { EvalQuestion } from '../../../../app';

/**
 * API endpoint for processing OMR images
 * This endpoint only processes the image and returns the results
 * It does not save the results to the database
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { imageData, evalData, rollCode = null, questions = null } = await request.json();

		if (!imageData || !evalData.code) {
			return json(
				{
					status: 'error',
					message: 'Argumentos faltantes'
				},
				{ status: 400 }
			);
		}

		// 1. Get evaluation code
		const evalCode = evalData.code;

		// 2. Get or use provided questions for this evaluation
		let questionsData: EvalQuestion[];

		// Use provided questions if available (to avoid redundant DB calls)
		if (questions && Array.isArray(questions) && questions.length > 0) {
			questionsData = questions;
		} else {
			// Fallback to fetching questions from database if not provided
			const { data, error } = await locals.supabase
				.from('eval_questions')
				.select('*')
				.eq('eval_code', evalCode)
				.order('order_in_eval');

			if (error || !data) {
				console.error('Error fetching questions:', error);
				return json(
					{
						status: 'error',
						message: 'Failed to fetch evaluation questions'
					},
					{ status: 500 }
				);
			}

			questionsData = data;
		}

		// Calculate total number of questions
		const numQuestions = questionsData.length;
		const buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

		// 3. Process the image with OMR
		const omrResult = await processOmrImage(buffer, numQuestions, true);

		if (omrResult.status === 'error') {
			return json(omrResult);
		}

		// 4. Use provided roll code or the one from OMR processing
		const studentRollCode = rollCode || omrResult.studentCode;

		// 5. Check if roll code is valid (4 digits)
		if (!/^\d{4}$/.test(studentRollCode)) {
			return json(
				{
					status: 'error',
					errorType: 'invalid_roll_code',
					message: `Código inválido: ${studentRollCode}. Debe ser 4 dígitos numéricos.`,
					detectedCode: omrResult.studentCode,
					omrResult
				},
				{ status: 400 }
			);
		}

		// 6. Check for duplicate roll code in this level/group
		const { data: duplicateCheck, error: duplicateError } = await locals.supabase
			.from('registers')
			.select('code, students(name, last_name)')
			.eq('roll_code', studentRollCode)
			.eq('level_code', evalData.level_code)
			.eq('group_name', evalData.group_name);

		if (duplicateError) {
			console.error('Error checking for duplicates:', duplicateError);
			return json(
				{
					status: 'error',
					message: 'Error al verificar duplicados'
				},
				{ status: 500 }
			);
		}

		// 7. Process answers
		const answers = omrResult.answers;
		let correctCount = 0;
		let incorrectCount = 0;
		let blankCount = 0;
		let totalScore = 0;

		// Calculate scores but don't save yet
		for (const question of questionsData) {
			const questionIndex = question.order_in_eval - 1; // Convert to 0-based index
			const studentAnswer = answers[questionIndex];

			// Calculate score for this question
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

		// 8. Return processing results with student info if found
		const studentInfo =
			duplicateCheck && duplicateCheck.length > 0
				? {
						name: duplicateCheck[0].students.name,
						lastName: duplicateCheck[0].students.last_name,
						rollCode: studentRollCode,
						registerCode: duplicateCheck[0].code
					}
				: null;

		return json({
			status: 'success',
			detectedCode: omrResult.studentCode, // Original detected code
			studentCode: studentRollCode, // Final code (could be manually provided)
			student: studentInfo,
			duplicateFound: duplicateCheck && duplicateCheck.length > 0,
			validationStatus: {
				isValid: studentInfo !== null,
				message:
					studentInfo === null
						? `No se encontró estudiante con código ${studentRollCode} en este nivel/grupo`
						: 'Estudiante encontrado'
			},
			results: {
				correctCount,
				incorrectCount,
				blankCount,
				totalScore
			},
			answers: Object.entries(answers).reduce(
				(acc, [key, value]) => {
					acc[Number(key)] = value;
					return acc;
				},
				{} as Record<number, AnswerValue>
			),
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
