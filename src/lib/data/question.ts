/**
 * QUESTIONS DATA LAYER - Modern Clean Architecture
 *
 * ARCHITECTURE PRINCIPLE: Use locals.db to avoid duplicate instances
 */

import type { EvalQuestions } from '$lib/types';
import type { Database } from '$lib/database';

// Type for questions with numeric score_percent
export type TransformedEvalQuestion = Omit<EvalQuestions, 'score_percent'> & {
	score_percent: number;
};

/**
 * Fetch questions for an evaluation
 */
export async function fetchQuestions(
	db: Database,
	evalCode: string
): Promise<TransformedEvalQuestion[]> {
	try {
		const data = await db
			.selectFrom('eval_questions')
			.selectAll()
			.where('eval_code', '=', evalCode)
			.orderBy('order_in_eval', 'asc')
			.execute();

		// Handle numeric conversion for score_percent inline
		return data.map((question) => ({
			...question,
			score_percent:
				typeof question.score_percent === 'string'
					? parseFloat(question.score_percent)
					: Number(question.score_percent)
		}));
	} catch (error) {
		console.error('Error fetching questions:', error);
		return [];
	}
}

/**
 * Check if evaluation has questions
 */
export async function hasEvalQuestions(db: Database, evalCode: string): Promise<boolean> {
	try {
		const data = await db
			.selectFrom('eval_questions')
			.select('code')
			.where('eval_code', '=', evalCode)
			.limit(1)
			.execute();

		return data.length > 0;
	} catch (error) {
		console.error('Error checking eval questions:', error);
		return false;
	}
}
