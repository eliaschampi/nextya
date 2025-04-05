import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processOmrImage } from '$lib/omrProcessor';
import type { AnswerValue } from '$lib/omrProcessor';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { imageData, evalData, selectionRect } = await request.json();

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

		// 2. Get questions for this evaluation
		const { data: questionsData, error: questionsError } = await locals.supabase
			.from('eval_questions')
			.select('*')
			.eq('eval_code', evalCode)
			.order('order_in_eval');

		if (questionsError || !questionsData) {
			console.error('Error fetching questions:', questionsError);
			return json(
				{
					status: 'error',
					message: 'Failed to fetch evaluation questions'
				},
				{ status: 500 }
			);
		}

		// Calculate total number of questions
		const numQuestions = questionsData.length;

		// 3. Process the image with OMR
		const omrResult = await processOmrImage(
			imageData,
			{
				numQuestions,
				selectionRect
			},
			true
		);

		if (omrResult.status === 'error') {
			return json(omrResult);
		}

		// 4. Find the student by roll code
		const studentRollCode = omrResult.studentCode;
		const { data: registerData, error: registerError } = await locals.supabase
			.from('registers')
			.select('*, students(*)')
			.eq('roll_code', studentRollCode)
			.eq('level_code', evalData.level_code)
			.eq('group_name', evalData.group_name)
			.single();

		if (registerError || !registerData) {
			return json(
				{
					status: 'error',
					message: `Student with roll code ${studentRollCode} not found in level ${evalData.level_code} and group ${evalData.group_name}`
				},
				{ status: 404 }
			);
		}

		// 5. Process answers and calculate score
		const answers = omrResult.answers;
		let correctCount = 0;
		let incorrectCount = 0;
		let blankCount = 0;
		let totalScore = 0;

		// Prepare answers for batch insert
		const answersToInsert = [];

		for (const question of questionsData) {
			const questionIndex = question.order_in_eval - 1; // Convert to 0-based index
			const studentAnswer = answers[questionIndex];

			// Convert OMR answer format (lowercase) to database format (uppercase)
			let formattedStudentAnswer: string | null = null;
			if (studentAnswer && studentAnswer !== 'error_multiple') {
				formattedStudentAnswer = studentAnswer.toUpperCase();
			}

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

			// Add to batch insert
			answersToInsert.push({
				register_code: registerData.code,
				question_code: question.code,
				student_answer: formattedStudentAnswer
			});
		}

		// 6. Insert answers in a transaction
		const { error: insertError } = await locals.supabase.rpc('process_evaluation_results', {
			p_register_code: registerData.code,
			p_eval_code: evalCode,
			p_answers: answersToInsert,
			p_correct_count: correctCount,
			p_blank_count: blankCount,
			p_incorrect_count: incorrectCount,
			p_score: totalScore
		});

		if (insertError) {
			console.error('Error inserting results:', insertError);
			return json(
				{
					status: 'error',
					message: 'Failed to save evaluation results'
				},
				{ status: 500 }
			);
		}

		// 7. Return success with student info and results
		return json({
			status: 'success',
			studentCode: studentRollCode,
			student: {
				name: registerData.students.name,
				lastName: registerData.students.last_name,
				rollCode: registerData.roll_code
			},
			results: {
				correctCount,
				incorrectCount,
				blankCount,
				totalScore
			},
			answers: Object.entries(answers).reduce(
				(acc, [key, value]) => {
					acc[Number(key) + 1] = value; // Convert back to 1-based for display
					return acc;
				},
				{} as Record<number, AnswerValue>
			)
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
