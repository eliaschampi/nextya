import type { Eval, EvalSection } from '../../../../app';
import type { RequestHandler } from '@sveltejs/kit';
export const GET: RequestHandler = async ({ params, locals }) => {
	const { code } = params;
	console.log(code);
	if (!code) return new Response(JSON.stringify([]));
	const { data, error: supabaseError } = await locals.supabase
		.from('evals')
		.select(`*, levels (name), eval_sections (*, courses (name))`)
		.eq('level_code', code)
		.order('eval_date', { ascending: true });

	if (supabaseError) return new Response(JSON.stringify([]), { status: 500 });

	const evals = data.map(
		(
			evalItem: Eval & {
				eval_sections: Array<EvalSection & { courses: { name: string } }>;
				levels: { name: string };
			}
		) => ({
			...evalItem,
			eval_sections: evalItem.eval_sections.map((section) => ({
				code: section.code,
				eval_code: section.eval_code,
				course_code: section.course_code,
				order_in_eval: section.order_in_eval,
				question_count: section.question_count,
				course_name: section.courses.name
			}))
		})
	);

	return new Response(JSON.stringify(evals), {
		headers: { 'Content-Type': 'application/json' }
	});
};
