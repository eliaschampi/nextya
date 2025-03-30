import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { EvalQuestion, EvalSection, Eval } from '../../../../../app';

export const load: PageServerLoad = async ({ params, locals }) => {
	const evalCode = params.eval_code;
	if (!evalCode) {
		throw error(404, 'Examen no encontrado');
	}

	// Get the eval data
	const { data: evalData, error: evalError } = await locals.supabase
		.from('evals')
		.select('*, levels(name)')
		.eq('code', evalCode)
		.single();

	if (evalError || !evalData) {
		console.error('Error fetching eval:', evalError);
		throw error(404, 'Examen no encontrado');
	}

	// Get the eval sections with courses
	const { data: sectionsData, error: sectionsError } = await locals.supabase
		.from('eval_sections')
		.select('*, courses:course_code(name)')
		.eq('eval_code', evalCode)
		.order('order_in_eval');

	if (sectionsError) {
		console.error('Error fetching sections:', sectionsError);
		throw error(500, 'Error cargando secciones del examen');
	}

	// Add the course_name to the sections from the join
	const sections = sectionsData.map((section: { courses?: { name: string } }) => ({
		...section,
		course_name: section.courses?.name
	}));

	// Get existing questions for this eval
	const { data: questionsData, error: questionsError } = await locals.supabase
		.from('eval_questions')
		.select('*')
		.eq('eval_code', evalCode)
		.order('order_in_eval');

	if (questionsError) {
		console.error('Error fetching questions:', questionsError);
		throw error(500, 'Error cargando preguntas del examen');
	}

	return {
		eval: evalData as Eval & { levels: { name: string } },
		sections: sections as (EvalSection & { course_name: string })[],
		existingQuestions: questionsData as EvalQuestion[],
		title: `Claves - ${evalData.name}`
	};
};

export const actions: Actions = {
	saveQuestions: async ({ request, locals, params }) => {
		const evalCode = params.eval_code;
		const formData = await request.formData();

		// 1. Obtener todas las secciones del examen en orden
		const { data: sections } = await locals.supabase
			.from('eval_sections')
			.select('code, order_in_eval, question_count')
			.eq('eval_code', evalCode)
			.order('order_in_eval');

		if (!sections || sections.length === 0) {
			return fail(400, { error: 'No hay secciones definidas para este examen' });
		}

		// 2. Calcular el inicio de cada sección para numeración global
		const sectionStarts: Record<string, number> = {};
		let startNumber = 1;

		sections.forEach((section) => {
			sectionStarts[section.code] = startNumber;
			startNumber += section.question_count;
		});

		// 3. Recopilar todas las preguntas del formulario
		const questions: Record<
			string,
			{
				eval_code: string;
				section_code: string;
				order_in_eval: number;
				correct_key: string;
				omitable: boolean;
				score_percent: number;
			}
		> = {};
		for (const [key, value] of formData.entries()) {
			// Solo procesar campos de preguntas
			if (key.startsWith('question_')) {
				// Extraer el código de sección y número de pregunta
				const parts = key.split('_');
				const localOrder = parseInt(parts[parts.length - 1]);
				const sectionCode = parts.slice(1, parts.length - 1).join('_');

				if (!sectionCode || isNaN(localOrder)) continue;

				// Calcular numeración global basada en la sección y orden local
				const globalOrder = sectionStarts[sectionCode] + localOrder - 1;
				const questionId = `${sectionCode}_${localOrder}`;

				// Obtener datos adicionales (omitible, valor)
				const isOmitable = formData.get(`omitable_${sectionCode}_${localOrder}`) === 'on';
				const scoreValue = parseFloat(
					(formData.get(`score_${sectionCode}_${localOrder}`) as string) || '1.00'
				);

				questions[questionId] = {
					eval_code: evalCode,
					section_code: sectionCode,
					order_in_eval: globalOrder,
					correct_key: value as string,
					omitable: isOmitable,
					score_percent: isNaN(scoreValue) ? 1.0 : scoreValue
				};
			}
		}

		// 4. Convertir a array y verificar que no haya duplicados
		const questionsArray = Object.values(questions);

		// Verificar numeración única
		const orderSet = new Set();
		const duplicates = [];

		for (const q of questionsArray) {
			if (orderSet.has(q.order_in_eval)) {
				duplicates.push(q.order_in_eval);
			}
			orderSet.add(q.order_in_eval);
		}

		if (duplicates.length > 0) {
			console.error(`Duplicados encontrados:`, duplicates);
			return fail(400, {
				error: 'Error: Se encontraron valores duplicados en el orden de preguntas'
			});
		}

		// 5. Eliminar preguntas existentes
		const { error: deleteError } = await locals.supabase
			.from('eval_questions')
			.delete()
			.eq('eval_code', evalCode);

		if (deleteError) {
			console.error('Error al eliminar preguntas existentes:', deleteError);
			return fail(500, { error: 'Error al eliminar preguntas existentes' });
		}

		// 6. Guardar nuevas preguntas
		if (questionsArray.length > 0) {
			const { error: insertError } = await locals.supabase
				.from('eval_questions')
				.insert(questionsArray);

			if (insertError) {
				console.error('Error al guardar preguntas:', insertError);
				return fail(500, { error: 'Error al guardar preguntas' });
			}
		}

		return { success: true, type: 'success' };
	}
};
