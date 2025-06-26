/**
 * STUDENT SEARCH API - Modern Clean Architecture
 *
 * ARCHITECTURE PRINCIPLE: Use repository pattern, consistent error handling
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { studentsRepository } from '$lib/database/repositories';

export const GET: RequestHandler = async ({ url }) => {
	const searchQuery = url.searchParams.get('search');

	if (!searchQuery) {
		return json([]);
	}

	try {
		const students = await studentsRepository.search(searchQuery);
		return json(students);
	} catch (error) {
		console.error('Error searching students:', error);
		return json({ error: 'Error interno del servidor al buscar estudiantes' }, { status: 500 });
	}
};
