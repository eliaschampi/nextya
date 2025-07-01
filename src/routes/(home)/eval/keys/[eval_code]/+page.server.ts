import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { EvalQuestions, Evals, EvalSectionWithCourse } from '$lib/types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const evalCode = params.eval_code;
	if (!evalCode) {
		throw error(404, 'Examen no encontrado');
	}

	try {
		// Get the eval data with level name
		const evalData = await locals.db
			.selectFrom('evals')
			.innerJoin('levels', 'levels.code', 'evals.level_code')
			.select([
				'evals.code',
				'evals.name',
				'evals.level_code',
				'evals.group_name',
				'evals.eval_date',
				'evals.user_code',
				'evals.created_at',
				'evals.updated_at',
				'levels.name as level_name'
			])
			.where('evals.code', '=', evalCode)
			.executeTakeFirst();

		if (!evalData) {
			throw error(404, 'Examen no encontrado');
		}

		// Get the eval sections with courses
		const sectionsData = await locals.db
			.selectFrom('eval_sections')
			.innerJoin('courses', 'courses.code', 'eval_sections.course_code')
			.select([
				'eval_sections.code',
				'eval_sections.eval_code',
				'eval_sections.course_code',
				'eval_sections.order_in_eval',
				'eval_sections.question_count',
				'courses.name as course_name'
			])
			.where('eval_sections.eval_code', '=', evalCode)
			.orderBy('eval_sections.order_in_eval', 'asc')
			.execute();

		// Transform sections to include course_name
		const sections: EvalSectionWithCourse[] = sectionsData.map((section) => ({
			code: section.code,
			eval_code: section.eval_code,
			course_code: section.course_code,
			order_in_eval: section.order_in_eval,
			question_count: section.question_count,
			course_name: section.course_name,
			courses: { name: section.course_name }
		}));

		// Get existing questions for this eval
		const questionsData = await locals.db
			.selectFrom('eval_questions')
			.selectAll()
			.where('eval_code', '=', evalCode)
			.orderBy('order_in_eval', 'asc')
			.execute();

		// Handle numeric conversion for score_percent inline
		const existingQuestions = questionsData.map(question => ({
			...question,
			score_percent: typeof question.score_percent === 'string'
				? parseFloat(question.score_percent)
				: Number(question.score_percent)
		}));

		return {
			eval: {
				...evalData,
				levels: { name: evalData.level_name }
			} as Evals & { levels: { name: string } },
			sections,
			existingQuestions,
			title: `Claves - ${evalData.name}`
		};
	} catch (err) {
		console.error('Error loading eval keys page:', err);
		throw error(500, 'Error cargando datos del examen');
	}
};

export const actions: Actions = {
	saveQuestions: async ({ request, locals, params }) => {
		const evalCode = params.eval_code;
		if (!evalCode) {
			return fail(400, { error: 'Código de examen no proporcionado' });
		}

		try {
			const formData = await request.formData();

			// 1. Get all sections of the exam in order
			const sections = await locals.db
				.selectFrom('eval_sections')
				.select(['code', 'order_in_eval', 'question_count'])
				.where('eval_code', '=', evalCode)
				.orderBy('order_in_eval', 'asc')
				.execute();

			if (!sections || sections.length === 0) {
				return fail(400, { error: 'No hay secciones definidas para este examen' });
			}

			// 2. Calculate section start positions for global numbering
			const sectionStarts: Record<string, number> = {};
			let startNumber = 1;

			sections.forEach((section) => {
				sectionStarts[section.code] = startNumber;
				startNumber += section.question_count;
			});

			// 3. Collect all questions from the form
			const questionsMap: Record<string, EvalQuestions> = {};

			// First, extract all question keys
			const questionKeys = Array.from(formData.keys()).filter((key) => key.startsWith('question_'));

			// Process each question
			for (const key of questionKeys) {
				// Extract section code and question number
				const parts = key.split('_');
				if (parts.length < 3) continue;

				const localOrder = parseInt(parts[parts.length - 1]);
				const sectionCode = parts.slice(1, parts.length - 1).join('_');

				if (!sectionCode || isNaN(localOrder) || !sectionStarts[sectionCode]) continue;

				// Calculate global numbering based on section and local order
				const globalOrder = sectionStarts[sectionCode] + localOrder - 1;

				// Get additional data (omitable, score)
				const correctKey = formData.get(key) as string;
				const isOmitable = formData.get(`omitable_${sectionCode}_${localOrder}`) === 'on';
				const scoreValue = parseFloat(
					(formData.get(`score_${sectionCode}_${localOrder}`) as string) || '1.0'
				);

				questionsMap[`${sectionCode}_${globalOrder}`] = {
					code: crypto.randomUUID(),
					eval_code: evalCode,
					section_code: sectionCode,
					order_in_eval: globalOrder,
					correct_key: correctKey || '',
					omitable: isOmitable,
					score_percent: (isNaN(scoreValue) ? 1.0 : scoreValue).toString()
				};
			}

			// Convert to array and verify no duplicates
			const questionsArray = Object.values(questionsMap);

			// Verify unique ordering
			const orderSet = new Set();
			const duplicates: number[] = [];

			for (const q of questionsArray) {
				if (orderSet.has(q.order_in_eval)) {
					duplicates.push(q.order_in_eval);
				}
				orderSet.add(q.order_in_eval);
			}

			if (duplicates.length > 0) {
				console.error(`Duplicados encontrados:`, duplicates);
				return fail(400, {
					error: `Error: Se encontraron valores duplicados en el orden de preguntas: ${duplicates.join(', ')}`
				});
			}

			// 5. Delete existing questions
			await locals.db.deleteFrom('eval_questions').where('eval_code', '=', evalCode).execute();

			// 6. Save new questions
			if (questionsArray.length > 0) {
				await locals.db.insertInto('eval_questions').values(questionsArray).execute();
			}

			return { success: true, type: 'success' };
		} catch (err) {
			console.error('Error saving questions:', err);
			return fail(500, { error: 'Error al guardar preguntas' });
		}
	}
};
