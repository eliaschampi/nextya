import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

/**
 * GET endpoint for dashboard counts
 * Returns counts of students, evaluations, levels, and courses
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		// Run queries in parallel for better performance
		const [studentsResponse, evalsResponse, levelsResponse, coursesResponse] = await Promise.all([
			// Get student count
			locals.supabase.from('students').select('code', { count: 'exact', head: true }),

			// Get evaluations count
			locals.supabase.from('evals').select('code', { count: 'exact', head: true }),

			// Get levels count
			locals.supabase.from('levels').select('code', { count: 'exact', head: true }),

			// Get courses count
			locals.supabase.from('courses').select('code', { count: 'exact', head: true })
		]);

		// Check for errors
		if (
			studentsResponse.error ||
			evalsResponse.error ||
			levelsResponse.error ||
			coursesResponse.error
		) {
			console.error('Error fetching counts:', {
				students: studentsResponse.error,
				evals: evalsResponse.error,
				levels: levelsResponse.error,
				courses: coursesResponse.error
			});
			return json({ error: 'Error al obtener conteos' }, { status: 500 });
		}

		// Return counts
		return json({
			students: studentsResponse.count || 0,
			evals: evalsResponse.count || 0,
			levels: levelsResponse.count || 0,
			courses: coursesResponse.count || 0
		});
	} catch (error) {
		console.error('Error in dashboard counts endpoint:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
