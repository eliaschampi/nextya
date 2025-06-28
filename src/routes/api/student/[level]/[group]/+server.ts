/**
 * STUDENTS BY LEVEL AND GROUP API - Modern Clean Architecture
 *
 * ARCHITECTURE PRINCIPLE: Use repository pattern, consistent error handling
 */

import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { studentsRepository } from '$lib/database/repositories';

export const GET: RequestHandler = async ({ params }) => {
	const { level, group } = params;

	if (!level || !group) {
		return json({ error: 'Código de nivel o grupo no proporcionado' }, { status: 400 });
	}

	try {
		const students = await studentsRepository.getByLevelAndGroup(level, group);
		return json(students);
	} catch (error) {
		console.error('Error fetching students by level and group:', error);
		return json({ error: 'Error interno del servidor al obtener estudiantes' }, { status: 500 });
	}
};
