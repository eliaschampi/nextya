// src/lib/stores/student.ts
import { writable, derived, get } from 'svelte/store';
import type { Student, StudentRegister, StudentResult } from '$lib/types';
import { showToast } from './Toast';

type StudentStoreState = {
	selectedStudent: Student | null;
	registers: StudentRegister[];
	results: StudentResult[];
	selectedRegister: string | null;
	isLoading: boolean;
};

function createStudentStore() {
	// Initialize with default values
	const { subscribe, set, update } = writable<StudentStoreState>({
		selectedStudent: null,
		registers: [],
		results: [],
		selectedRegister: null,
		isLoading: false
	});

	// Keep track of pages that have initialized the store
	const initializedPages = new Set<string>();

	return {
		subscribe,

		/**
		 * Set the selected student and load their data
		 */
		async selectStudent(student: Student, pageId: string) {
			// First update the store with the selected student
			update((state) => ({
				...state,
				selectedStudent: student,
				isLoading: true
			}));

			// If we already have data for this student and the page has been initialized, don't fetch again
			const currentState = get({ subscribe });
			if (
				currentState.registers.length > 0 &&
				initializedPages.has(pageId) &&
				currentState.selectedStudent?.code === student.code
			) {
				update((state) => ({ ...state, isLoading: false }));
				return;
			}

			try {
				// Load student results
				const response = await fetch(`/api/student/results/${student.code}`);
				if (!response.ok) {
					throw new Error('Error al cargar resultados del estudiante');
				}

				const data = await response.json();

				update((state) => ({
					...state,
					registers: data.registers || [],
					results: data.results || [],
					isLoading: false
				}));

				// Mark this page as initialized
				initializedPages.add(pageId);
			} catch (error) {
				console.error('Error loading student results:', error);
				showToast('No se pudieron cargar los resultados del estudiante', 'danger');

				update((state) => ({
					...state,
					registers: [],
					results: [],
					isLoading: false
				}));
			}
		},

		/**
		 * Set the selected register
		 */
		setSelectedRegister(registerCode: string | null) {
			update((state) => ({ ...state, selectedRegister: registerCode }));
		},

		/**
		 * Initialize the store from a student code
		 */
		async initFromStudentCode(studentCode: string | null, pageId: string) {
			if (!studentCode) return;

			update((state) => ({ ...state, isLoading: true }));

			try {
				// First load the student info
				const response = await fetch(`/api/student/${studentCode}`);
				if (!response.ok) {
					throw new Error('Error al cargar información del estudiante');
				}

				const studentData = await response.json();

				// Then load the student's results using the selectStudent method
				await this.selectStudent(studentData, pageId);
			} catch (error) {
				console.error('Error initializing from student code:', error);
				showToast('No se pudo cargar la información del estudiante', 'danger');

				update((state) => ({
					...state,
					selectedStudent: null,
					registers: [],
					results: [],
					isLoading: false
				}));
			}
		},

		/**
		 * Sort the results by date
		 */
		sortResults(sortOrder: 'asc' | 'desc') {
			update((state) => {
				const sortedResults = [...state.results].sort((a, b) => {
					if (sortOrder === 'desc') {
						return new Date(b.eval_date).getTime() - new Date(a.eval_date).getTime();
					} else {
						return new Date(a.eval_date).getTime() - new Date(b.eval_date).getTime();
					}
				});

				return { ...state, results: sortedResults };
			});
		},

		/**
		 * Reset the store state
		 */
		reset() {
			set({
				selectedStudent: null,
				registers: [],
				results: [],
				selectedRegister: null,
				isLoading: false
			});
			initializedPages.clear();
		}
	};
}

export const studentStore = createStudentStore();

// Derived stores for convenience
export const selectedStudent = derived(studentStore, ($store) => $store.selectedStudent);

export const registers = derived(studentStore, ($store) => $store.registers);

export const results = derived(studentStore, ($store) => $store.results);

export const selectedRegister = derived(studentStore, ($store) => $store.selectedRegister);

export const isLoading = derived(studentStore, ($store) => $store.isLoading);
