import { db } from '$lib/database';
import type { EvalQuestions } from '$lib/types';
import { transformEvalQuestions } from '$lib/utils';

export async function fetchQuestions(evalCode: string): Promise<EvalQuestions[]> {
	try {
		const data = await db
			.selectFrom('eval_questions')
			.selectAll()
			.where('eval_code', '=', evalCode)
			.orderBy('order_in_eval', 'asc')
			.execute();

		return transformEvalQuestions(data);
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
