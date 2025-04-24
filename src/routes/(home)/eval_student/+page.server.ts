import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Obtener el código del estudiante de los parámetros de URL
	const studentCode = url.searchParams.get('student');

	return {
		title: 'Estudiante',
		studentCode
	};
};
