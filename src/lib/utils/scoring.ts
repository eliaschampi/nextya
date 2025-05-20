import type { StudentAnswer, ApiOmrSuccessData } from '$lib/types/api';
import type { OmrSuccessResult, AnswerValue } from '$lib/omrProcessor';
import type { EvalQuestion, EvalSection, EvalSectionWithCourse } from '$lib/types';

const MAX_SCORE = 20;

/**
 * Calcula la nota vigesimal basada en el porcentaje de respuestas correctas ponderadas.
 */
function calculateVigesimalScore(correctWeightedSum: number, totalWeightedSum: number): number {
	if (totalWeightedSum === 0) return 0;
	const proportion = correctWeightedSum / totalWeightedSum;
	return parseFloat((proportion * MAX_SCORE).toFixed(2)); // Redondea a 2 decimales
}

/**
 * Procesa las respuestas del OMR y calcula los puntajes general y por sección.
 *
 * Comportamiento de preguntas omitibles:
 * - Si una pregunta está marcada como omitable (question.omitable = true) y el estudiante la deja en blanco,
 *   su score_percent NO se añade al total posible (no penaliza al estudiante).
 * - Si una pregunta es omitable pero el estudiante intenta responderla (correcta o incorrectamente),
 *   se trata como una pregunta normal.
 * - Si una pregunta NO es omitable, siempre se cuenta para el total posible.
 */
export function calculateScores(
	omrAnswers: OmrSuccessResult['answers'],
	sections: EvalSectionWithCourse[],
	questions: EvalQuestion[]
): { detailedAnswers: StudentAnswer[]; scores: ApiOmrSuccessData['scores'] } {
	const detailedAnswers: StudentAnswer[] = [];
	let generalCorrectCount = 0;
	let generalIncorrectCount = 0;
	let generalBlankCount = 0;
	let generalCorrectWeightedSum = 0;
	let generalTotalWeightedSum = 0;

	const sectionStats: Record<
		string,
		{
			section_name: string;
			correct_count: number;
			incorrect_count: number;
			blank_count: number;
			correctWeightedSum: number;
			totalWeightedSum: number;
			total_questions: number;
		}
	> = {};

	// Inicializar estadísticas por sección
	sections.forEach((section) => {
		sectionStats[section.code] = {
			section_name: section.course_name || 'Sin nombre',
			correct_count: 0,
			incorrect_count: 0,
			blank_count: 0,
			correctWeightedSum: 0,
			totalWeightedSum: 0,
			total_questions: 0
		};
	});

	// Procesar cada pregunta de la evaluación
	for (const question of questions) {
		const orderIndex = question.order_in_eval;
		const studentAnswerValue = (omrAnswers[orderIndex] as AnswerValue | undefined) ?? null;

		const is_blank = studentAnswerValue === null;
		const is_multiple = studentAnswerValue === 'error_multiple';
		const is_correct = studentAnswerValue === question.correct_key;

		const scorePercent = Number(question.score_percent) || 1.0; // Ponderación

		// Actualizar contadores generales
		if (is_correct) generalCorrectCount++;
		else if (is_blank) generalBlankCount++;
		else generalIncorrectCount++; // Incluye is_multiple y respuestas incorrectas

		// Si la pregunta es omitable y está en blanco, no se cuenta para el total
		// Solo se añade al total si: (1) no es omitable, o (2) es omitable pero el estudiante respondió
		const isOmitableAndBlank = question.omitable && is_blank;

		if (!isOmitableAndBlank) {
			generalTotalWeightedSum += scorePercent;
		}

		if (is_correct) {
			generalCorrectWeightedSum += scorePercent;
		}

		// Actualizar estadísticas de la sección
		const sectionCode = question.section_code;
		if (sectionStats[sectionCode]) {
			const stats = sectionStats[sectionCode];
			stats.total_questions++;

			// Aplicar la misma lógica de omitable para las secciones
			if (!isOmitableAndBlank) {
				stats.totalWeightedSum += scorePercent;
			}

			if (is_correct) {
				stats.correct_count++;
				stats.correctWeightedSum += scorePercent;
			} else if (is_blank) {
				stats.blank_count++;
			} else {
				stats.incorrect_count++;
			}
		}

		detailedAnswers.push({
			question_code: question.code,
			student_answer: studentAnswerValue,
			order_in_eval: orderIndex,
			correct_key: question.correct_key,
			score_percent: scorePercent,
			is_correct,
			is_blank,
			is_multiple,
			section_code: sectionCode
		});
	}

	// Calcular puntajes finales
	const generalScore = calculateVigesimalScore(generalCorrectWeightedSum, generalTotalWeightedSum);

	const scoresBySection: ApiOmrSuccessData['scores']['by_section'] = {};
	for (const sectionCode in sectionStats) {
		const stats = sectionStats[sectionCode];
		scoresBySection[sectionCode] = {
			section_name: stats.section_name,
			correct_count: stats.correct_count,
			incorrect_count: stats.incorrect_count,
			blank_count: stats.blank_count,
			total_questions: stats.total_questions,
			score: calculateVigesimalScore(stats.correctWeightedSum, stats.totalWeightedSum)
		};
	}

	return {
		detailedAnswers,
		scores: {
			general: {
				correct_count: generalCorrectCount,
				incorrect_count: generalIncorrectCount,
				blank_count: generalBlankCount,
				total_questions: questions.length,
				score: generalScore
			},
			by_section: scoresBySection
		}
	};
}
