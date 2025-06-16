import { db } from '$lib/database';
import type { EvalQuestion } from '$lib/types';

export async function fetchQuestions(evalCode: string): Promise<EvalQuestion[]> {
	try {
		const data = await db
			.selectFrom('evalQuestions')
			.selectAll()
			.where('evalCode', '=', evalCode)
			.orderBy('orderInEval', 'asc')
			.execute();

		// Transform to match expected EvalQuestion interface
		return data.map(question => ({
			code: question.code,
			eval_code: question.evalCode,
			section_code: question.sectionCode,
			order_in_eval: question.orderInEval,
			correct_key: question.correctKey,
			score_percent: Number(question.scorePercent),
			omitable: question.omitable
		})) as EvalQuestion[];
	} catch (error) {
		console.error('Error fetching questions:', error);
		return [];
	}
}

export async function hasEvalQuestions(evalCode: string): Promise<boolean> {
	try {
		const data = await db
			.selectFrom('evalQuestions')
			.select('code')
			.where('evalCode', '=', evalCode)
			.limit(1)
			.execute();

		return data && data.length > 0;
	} catch (error) {
		console.error('Error checking eval questions:', error);
		return false;
	}
}
