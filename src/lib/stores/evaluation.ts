// src/lib/stores/evaluation.ts
import { writable, derived, get } from 'svelte/store';
import type { EvalWithSections } from '$lib/types';

type EvaluationStoreState = {
	selectedEval: EvalWithSections | null;
	selectedLevelCode: string;
	availableEvals: EvalWithSections[];
	isLoading: boolean;
};

function createEvaluationStore() {
	// Initialize with default values
	const { subscribe, set, update } = writable<EvaluationStoreState>({
		selectedEval: null,
		selectedLevelCode: '',
		availableEvals: [],
		isLoading: false
	});

	// Keep track of pages that have initialized the store
	// This helps prevent unnecessary API calls when navigating between pages
	const initializedPages = new Set<string>();

	return {
		subscribe,

		/**
		 * Set the selected level code and load evaluations for that level
		 */
		async setLevelCode(levelCode: string, pageId: string) {
			if (!levelCode) {
				update((state) => ({ ...state, selectedLevelCode: '', availableEvals: [] }));
				return;
			}

			update((state) => {
				// Only set loading if we're changing the level
				if (state.selectedLevelCode !== levelCode) {
					return { ...state, selectedLevelCode: levelCode, isLoading: true };
				}
				return { ...state, selectedLevelCode: levelCode };
			});

			// If we already have evaluations for this level, don't fetch again
			const currentState = get({ subscribe });
			if (
				currentState.availableEvals.length > 0 &&
				currentState.availableEvals[0]?.level_code === levelCode &&
				initializedPages.has(pageId)
			) {
				update((state) => ({ ...state, isLoading: false }));
				return;
			}

			try {
				const response = await fetch(`/api/eval/${levelCode}`);
				if (!response.ok) throw new Error('Failed to load evaluations');

				const evaluations = await response.json();
				update((state) => ({
					...state,
					availableEvals: evaluations,
					isLoading: false
				}));

				// Mark this page as initialized
				initializedPages.add(pageId);
			} catch (error) {
				console.error('Error loading evaluations:', error);
				update((state) => ({
					...state,
					availableEvals: [],
					isLoading: false
				}));
			}
		},

		/**
		 * Set the selected evaluation
		 */
		setSelectedEval(evalItem: EvalWithSections | null) {
			update((state) => ({ ...state, selectedEval: evalItem }));
		},

		/**
		 * Initialize the store from URL parameters
		 */
		async initFromUrl(levelCode: string | null, evalCode: string | null, pageId: string) {
			if (!levelCode) return;

			// Set the level code first (this will load available evaluations)
			await this.setLevelCode(levelCode, pageId);

			// If we have an eval code, find and select that evaluation
			if (evalCode) {
				const state = get({ subscribe });
				const evalItem = state.availableEvals.find((e) => String(e.code) === evalCode);
				if (evalItem) {
					this.setSelectedEval(evalItem);
				}
			}
		},

		/**
		 * Reset the store state
		 */
		reset() {
			set({
				selectedEval: null,
				selectedLevelCode: '',
				availableEvals: [],
				isLoading: false
			});
			initializedPages.clear();
		}
	};
}

export const evaluationStore = createEvaluationStore();

// Derived stores for convenience
export const selectedEval = derived(evaluationStore, ($store) => $store.selectedEval);

export const selectedLevelCode = derived(evaluationStore, ($store) => $store.selectedLevelCode);

export const availableEvals = derived(evaluationStore, ($store) => $store.availableEvals);

export const isLoadingEvals = derived(evaluationStore, ($store) => $store.isLoading);
