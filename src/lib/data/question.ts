import { db } from '$lib/database';
import type { EvalQuestions } from '$lib/types';

export async function fetchQuestions(evalCode: string): Promise<EvalQuestions[]> {
	try {
		const data = await db
			.selectFrom('eval_questions')
			.selectAll()
			.where('eval_code', '=', evalCode)
			.orderBy('order_in_eval', 'asc')
			.execute();
		// Transform to match expected EvalQuestion interface
		return data.map((question) => ({
			code: question.code,
			eval_code: question.eval_code,
			section_code: question.section_code,
			order_in_eval: question.order_in_eval,
			correct_key: question.correct_key,
			score_percent: Number(question.score_percent),
			omitable: question.omitable
		}));
	} catch {
		return [];
	}
}

export async function hasEvalQuestions(evalCode: string): Promise<boolean> {
	try {
		const data = await db
			.selectFrom('eval_questions')
			.select('code')
			.where('eval_code', '=', evalCode)
			.limit(1)
			.execute();

		return data && data.length > 0;
	} catch {
		return false;
	}
}
