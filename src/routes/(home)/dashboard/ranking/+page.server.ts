import { getLevels } from '$lib/data/levels';
import { getStudentRanking, getAvailableGroups } from '$lib/data/dashboard/ranking';
import type { Levels } from '$lib/types';
import type { StudentRanking } from '$lib/types/dashboard/ranking';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userCode = locals.user?.code;

	// Check permissions
	if (!userCode || !(await locals.can('dashboard:ranking'))) {
		return {
			levels: [],
			students: [],
			availableGroups: [],
			selectedLevel: null,
			selectedGroup: null
		};
	}

	// Get levels
	const levels: Levels[] = await getLevels(locals.db, userCode);

	// Get URL parameters for filtering
	const selectedLevel = url.searchParams.get('level');
	const selectedGroup = url.searchParams.get('group');

	// Get available groups if a level is selected
	let availableGroups: string[] = [];
	if (selectedLevel) {
		availableGroups = await getAvailableGroups(locals.db, selectedLevel);
	}

	// Get ranking data with filters
	const students: StudentRanking[] = await getStudentRanking(locals.db, {
		level_code: selectedLevel || '',
		group_name: selectedGroup || ''
	});

	return {
		levels,
		students,
		availableGroups,
		selectedLevel,
		selectedGroup
	};
};
