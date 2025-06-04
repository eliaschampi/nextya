import type { EvaluationResult, SectionScore, StudentQuestionAnswer } from '$lib/types';

interface MainResult {
	code: string;
	eval_code: string;
	correct_count: number;
	incorrect_count: number;
	blank_count: number;
	score: number;
	registers: {
		code: string;
		roll_code: string;
		group_name: string;
		level_code: string;
		student_code: string;
		students: {
			name: string;
			last_name: string;
		};
	};
	evals: {
		name: string;
		eval_date: string;
		level_code: string;
		levels: {
			name: string;
		};
	};
}

interface SectionResult {
	section_code: string | null;
	correct_count: number;
	incorrect_count: number;
	blank_count: number;
	score: number;
	eval_sections?: {
		courses?: {
			name: string;
		};
	};
}

interface AnswerData {
	question_code: string;
	student_answer: string | null;
	eval_questions: {
		order_in_eval: number;
		correct_key: string;
		section_code: string;
		eval_sections?: {
			courses?: {
				name: string;
			};
		};
	};
}

/**
 * Formats the raw database result into a structured EvaluationResult object
 * This utility helps maintain consistency between different API endpoints
 */
export function formatEvaluationResult(
	mainResult: MainResult,
	sectionResults: SectionResult[],
	answersData: AnswerData[]
): EvaluationResult {
	// Format section scores
	const formattedSectionScores: Record<string, SectionScore> = {};

	for (const section of sectionResults) {
		const sectionCode = section.section_code;
		if (!sectionCode) continue; // Skip if no section code

		const courseName = section.eval_sections?.courses?.name || 'Sin nombre';

		formattedSectionScores[sectionCode] = {
			section_code: sectionCode,
			section_name: courseName,
			correct_count: section.correct_count,
			incorrect_count: section.incorrect_count,
			blank_count: section.blank_count,
			total_questions: section.correct_count + section.incorrect_count + section.blank_count,
			score: section.score
		};
	}

	// Format answers
	const formattedAnswers: StudentQuestionAnswer[] = answersData.map((answer) => {
		// Determine if answer is blank or multiple
		const isBlank = answer.student_answer === null;
		const isMultiple = answer.student_answer === 'error_multiple';

		// Determine if answer is correct by comparing with correct key
		const isCorrect =
			!isBlank && !isMultiple && answer.student_answer === answer.eval_questions.correct_key;

		return {
			question_code: answer.question_code,
			answer: answer.student_answer,
			student_answer: answer.student_answer,
			is_correct: isCorrect,
			is_blank: isBlank,
			is_multiple: isMultiple,
			order_in_eval: answer.eval_questions.order_in_eval,
			correct_key: answer.eval_questions.correct_key,
			section_code: answer.eval_questions.section_code,
			section_name: answer.eval_questions.eval_sections?.courses?.name || null,
			score_percent: 0 // Default value, can be calculated if needed
		};
	});

	// Sort answers by order_in_eval to ensure correct ordering
	formattedAnswers.sort((a, b) => a.order_in_eval - b.order_in_eval);

	// Build the response
	return {
		code: mainResult.code,
		student: {
			code: mainResult.registers.student_code,
			name: mainResult.registers.students.name,
			last_name: mainResult.registers.students.last_name
		},
		register: {
			code: mainResult.registers.code,
			roll_code: mainResult.registers.roll_code,
			group_name: mainResult.registers.group_name,
			level_code: mainResult.registers.level_code
		},
		eval: {
			code: mainResult.eval_code,
			name: mainResult.evals.name,
			date: mainResult.evals.eval_date,
			level_name: mainResult.evals.levels.name
		},
		scores: {
			general: {
				correct_count: mainResult.correct_count,
				incorrect_count: mainResult.incorrect_count,
				blank_count: mainResult.blank_count,
				total_questions:
					mainResult.correct_count + mainResult.incorrect_count + mainResult.blank_count,
				score: mainResult.score
			},
			by_section: formattedSectionScores
		},
		answers: formattedAnswers
	};
}
