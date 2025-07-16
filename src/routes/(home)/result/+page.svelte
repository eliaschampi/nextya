<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import EvalSelector from '$lib/components/EvalSelector.svelte';
	import EvalHeader from '$lib/components/EvalHeader.svelte';
	import Table from '$lib/components/Table.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { showToast } from '$lib/stores/Toast';
	import {
		School,
		Search,
		SortAsc,
		SortDesc,
		FileDown,
		Trash2,
		AlertTriangle
	} from 'lucide-svelte';
	import type { EvalWithSections, ResultItem } from '$lib/types';
	import type { TableColumn } from '$lib/types/table';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { can } from '$lib/stores/permissions';
	import { evaluationStore } from '$lib/stores/evaluation';

	// Props from server
	const { data } = $props<{
		data: {
			levels: { code: string; name: string }[];
			levelCode: string | null;
			evalCode: string | null;
		};
	}>();

	// Store state
	let storeState = $state({
		selectedEval: null as EvalWithSections | null,
		selectedLevelCode: '',
		availableEvals: [] as EvalWithSections[],
		isLoading: false
	});

	// State variables
	let evalSelectionModalOpen = $state(false);
	let loadingResults = $state(false);
	let results = $state<ResultItem[]>([]);
	let sortOrder = $state<'asc' | 'desc'>('desc'); // Default sort by highest score
	let searchQuery = $state('');

	// Permissions - using Svelte 5 reactive approach
	let canViewDetails = $derived(can('results:read'));
	let canDeleteResults = $derived(can('results:delete'));

	// Delete state
	let deleteModalOpen = $state(false);
	let resultToDelete = $state<ResultItem | null>(null);
	let deleteAllMode = $state(false);
	let isDeleting = $state(false);

	// Caché de resultados por evaluación con límite de tamaño
	const resultsCache = $state<Record<string, { data: ResultItem[]; timestamp: number }>>({});
	// TTL de caché: 5 minutos
	const CACHE_TTL = 5 * 60 * 1000;
	const MAX_CACHE_SIZE = 10; // Máximo 10 evaluaciones en caché

	// Estado para paginación
	let currentPage = $state(1);
	let pageSize = $state(20); // Resultados por página

	// Store subscription cleanup
	let unsubscribeStore: (() => void) | null = null;

	// Initialize the store from URL parameters
	onMount(() => {
		// Check stored state first
		checkStoredState();

		// Subscribe to store
		unsubscribeStore = evaluationStore.subscribe((state) => {
			const prevEval = storeState.selectedEval;
			const prevLevel = storeState.selectedLevelCode;

			storeState = state;

			// Load results when evaluation changes
			if (state.selectedEval && state.selectedEval !== prevEval) {
				loadResults(state.selectedEval.code);
			}

			// Update URL when selection changes
			if (state.selectedLevelCode && state.selectedLevelCode !== prevLevel) {
				updateUrlWithParams();
			}
		});

		if (data.levelCode) {
			evaluationStore.initFromUrl(data.levelCode, data.evalCode, 'result-page');
		}

		// Cleanup function
		return () => {
			unsubscribeStore?.();
		};
	});

	// Computed value for filtered results
	const filteredResults = $derived(
		results.filter((result) => {
			if (!searchQuery.trim()) return true;

			const query = searchQuery.toLowerCase();
			return (
				result.name?.toLowerCase().includes(query) ||
				result.last_name?.toLowerCase().includes(query) ||
				result.roll_code?.includes(query)
			);
		})
	);

	// Resultados paginados
	const paginatedResults = $derived(
		filteredResults.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	// Total de páginas
	const totalPages = $derived(Math.ceil(filteredResults.length / pageSize));

	// Función para cambiar de página
	function goToPage(page: number) {
		if (page < 1 || page > totalPages) return;
		currentPage = page;
	}

	// Functions
	function openEvalModal() {
		evalSelectionModalOpen = true;
	}

	async function updateUrlWithParams() {
		// Update URL with current selection
		goto(
			`/result?level=${storeState.selectedLevelCode}${storeState.selectedEval ? `&eval=${storeState.selectedEval.code}` : ''}`,
			{
				keepFocus: true,
				noScroll: true,
				replaceState: true
			}
		);
	}

	// Cache management function
	function cleanupCache() {
		const now = Date.now();
		const cacheKeys = Object.keys(resultsCache);

		// Remove expired entries
		cacheKeys.forEach((key) => {
			if (now - resultsCache[key].timestamp > CACHE_TTL) {
				delete resultsCache[key];
			}
		});

		// If still over limit, remove oldest entries
		const remainingKeys = Object.keys(resultsCache);
		if (remainingKeys.length > MAX_CACHE_SIZE) {
			const sortedKeys = remainingKeys.sort(
				(a, b) => resultsCache[a].timestamp - resultsCache[b].timestamp
			);
			const keysToRemove = sortedKeys.slice(0, remainingKeys.length - MAX_CACHE_SIZE);
			keysToRemove.forEach((key) => delete resultsCache[key]);
		}
	}

	// These functions are used in the EvalSelector component
	async function loadResults(evalCode: string) {
		loadingResults = true;

		// Verificar si hay datos en caché y si son válidos
		const now = Date.now();
		if (resultsCache[evalCode] && now - resultsCache[evalCode].timestamp < CACHE_TTL) {
			// Usar datos de caché
			results = resultsCache[evalCode].data;
			loadingResults = false;
			return;
		}

		try {
			const response = await fetch(`/api/eval/results/${evalCode}`);
			if (!response.ok) {
				throw new Error('Error al cargar resultados');
			}
			const data = await response.json();

			// Clean up cache before adding new entry
			cleanupCache();

			// Guardar en caché
			resultsCache[evalCode] = {
				data,
				timestamp: now
			};

			results = data;
			// Resetear a la primera página cuando se cargan nuevos resultados
			currentPage = 1;
		} catch (error) {
			console.error('Error cargando resultados:', error);
			showToast('No se pudieron cargar los resultados', 'danger');
			results = [];
		} finally {
			loadingResults = false;
		}
	}

	function toggleSortOrder() {
		sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
		sortResults();
	}

	function sortResults() {
		results = [...results].sort((a, b) => {
			if (sortOrder === 'desc') {
				return b.score - a.score;
			} else {
				return a.score - b.score;
			}
		});
	}

	function viewStudentDetails(result: ResultItem) {
		// Store current state in sessionStorage for better back navigation
		try {
			sessionStorage.setItem(
				'result_page_state',
				JSON.stringify({
					levelCode: storeState.selectedLevelCode,
					evalCode: storeState.selectedEval?.code,
					timestamp: Date.now()
				})
			);
		} catch (e) {
			console.error('Error storing state in sessionStorage:', e);
		}

		// Redirect to the eval/answer page with fromPage parameter
		goto(
			`/eval/answer/${result.result_code}?from=result&level=${storeState.selectedLevelCode}&eval=${storeState.selectedEval?.code}`
		);
	}

	async function exportToExcel() {
		if (!storeState.selectedEval) return;

		try {
			showToast('Preparando exportación...', 'info');

			// Use the browser's fetch API to download the file
			const response = await fetch(`/api/impcsv/export?eval_code=${storeState.selectedEval.code}`, {
				method: 'GET'
			});

			if (!response.ok) {
				throw new Error('Error al exportar resultados');
			}

			// Get the filename from the Content-Disposition header or use a default
			const contentDisposition = response.headers.get('Content-Disposition');
			let filename = 'resultados.csv';

			if (contentDisposition) {
				const filenameMatch = contentDisposition.match(/filename="(.+)"/);
				if (filenameMatch && filenameMatch[1]) {
					filename = filenameMatch[1];
				}
			}

			// Convert the response to a blob
			const blob = await response.blob();

			// Create a download link and trigger the download
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();

			// Clean up
			URL.revokeObjectURL(url);
			document.body.removeChild(a);

			showToast('Resultados exportados correctamente', 'success');
		} catch (error) {
			console.error('Error exportando resultados:', error);
			showToast('No se pudieron exportar los resultados', 'danger');
		}
	}

	// Delete functions
	function openDeleteModal(result: ResultItem | null = null) {
		resultToDelete = result;
		deleteAllMode = result === null;
		deleteModalOpen = true;
	}

	function closeDeleteModal() {
		deleteModalOpen = false;
		resultToDelete = null;
		deleteAllMode = false;
	}

	async function confirmDelete() {
		if (!storeState.selectedEval) return;

		isDeleting = true;
		try {
			const resultIds = deleteAllMode ? [] : resultToDelete ? [resultToDelete.result_code] : [];

			const response = await fetch(`/api/eval/results/${storeState.selectedEval.code}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ resultIds })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Error al eliminar resultados');
			}

			const data = await response.json();

			// Remove deleted items from cache
			if (deleteAllMode) {
				// Clear cache for this eval
				delete resultsCache[storeState.selectedEval.code];
				results = [];
			} else if (resultToDelete) {
				// Remove single item from results
				results = results.filter((r) => r.result_code !== resultToDelete?.result_code);

				// Update cache
				if (resultsCache[storeState.selectedEval.code]) {
					resultsCache[storeState.selectedEval.code].data = results;
				}
			}

			showToast(data.message || 'Resultados eliminados correctamente', 'success');
			closeDeleteModal();
		} catch (error) {
			showToast(error instanceof Error ? error.message : 'Error al eliminar resultados', 'danger');
		} finally {
			isDeleting = false;
		}
	}

	// Check for stored state from previous navigation in onMount
	function checkStoredState() {
		try {
			const storedState = sessionStorage.getItem('result_page_state');
			if (storedState) {
				const state = JSON.parse(storedState);
				const isRecent = Date.now() - state.timestamp < 5 * 60 * 1000; // 5 minutes

				if (isRecent && state.levelCode && state.evalCode) {
					// Clear the stored state to avoid using it again
					sessionStorage.removeItem('result_page_state');

					// If the stored state matches the URL parameters, use it
					if (state.levelCode === data.levelCode && state.evalCode === data.evalCode) {
						// The store will be initialized in onMount
						return true;
					}
				}
			}
		} catch (e) {
			console.error('Error reading from sessionStorage:', e);
		}
		return false;
	}

	// Define table columns
	const resultColumns: TableColumn<ResultItem>[] = [
		{ key: 'roll_code', label: 'Código', class: 'font-mono text-accent font-medium' },
		{ key: 'name', label: 'Nombre', class: 'font-medium' },
		{ key: 'last_name', label: 'Apellidos' },
		{ label: 'Grupo', class: 'text-center', render: groupCell },
		{ key: 'correct_count', label: 'Correctas', class: 'text-center text-success font-medium' },
		{ key: 'incorrect_count', label: 'Incorrectas', class: 'text-center text-error font-medium' },
		{ key: 'blank_count', label: 'En blanco', class: 'text-center opacity-70' },
		{ label: 'Nota', class: 'text-center font-bold', render: scoreCell },
		{ label: 'Acciones', class: 'text-center', render: actionsCell }
	];

	// Remove duplicate onMount since it's now handled above
</script>

<!-- Define snippets for custom cells -->
{#snippet groupCell(row: ResultItem)}
	<span class="badge badge-secondary">{row.group_name}</span>
{/snippet}

{#snippet scoreCell(row: ResultItem)}
	<span class="badge badge-lg {row.score >= 10.5 ? 'badge-success' : 'badge-error'}">
		{row.score.toFixed(2)}
	</span>
{/snippet}

{#snippet actionsCell(row: ResultItem)}
	<div class="flex gap-2 justify-center">
		<button
			class="btn btn-sm btn-primary btn-outline {canViewDetails ? '' : 'btn-disabled'}"
			onclick={() => viewStudentDetails(row)}
			title="Ver detalles"
			aria-label="Ver detalles del resultado"
			disabled={!canViewDetails}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-eye w-4 h-4"
				><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle
					cx="12"
					cy="12"
					r="3"
				/></svg
			>
		</button>
		<button
			class="btn btn-sm btn-error btn-outline {canDeleteResults ? '' : 'btn-disabled'}"
			onclick={() => openDeleteModal(row)}
			title="Eliminar resultado"
			aria-label="Eliminar resultado"
			disabled={!canDeleteResults}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-trash-2 w-4 h-4"
				><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path
					d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
				/><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg
			>
		</button>
	</div>
{/snippet}

<PageTitle
	title="Resultados"
	description="Visualiza los resultados de las evaluaciones por estudiante."
>
	<button
		class="btn btn-outline btn-primary"
		onclick={openEvalModal}
		aria-label="Seleccionar evaluación"
	>
		<School size={20} class="mr-2" />
		{storeState.selectedEval ? `${storeState.selectedEval.name}` : 'Seleccionar'}
	</button>
</PageTitle>

<main class="container mx-auto p-4">
	{#if storeState.selectedEval}
		<div class="mb-6">
			<EvalHeader evaluation={storeState.selectedEval} />
		</div>

		<div
			class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl mb-6"
		>
			<div class="card-body p-4">
				<div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
					<div class="flex items-center gap-2">
						<button
							class="btn btn-sm btn-primary btn-outline"
							onclick={toggleSortOrder}
							title={sortOrder === 'desc' ? 'Ordenar por nota menor' : 'Ordenar por nota mayor'}
						>
							<span class="mr-1">Nota</span>
							{#if sortOrder === 'desc'}
								<SortDesc size={16} />
							{:else}
								<SortAsc size={16} />
							{/if}
						</button>
						<button
							class="btn btn-sm btn-success btn-outline"
							onclick={exportToExcel}
							title="Exportar a Excel"
							disabled={filteredResults.length === 0}
						>
							<FileDown size={16} class="mr-1" />
							Excel
						</button>
						<button
							class="btn btn-sm btn-error btn-outline"
							onclick={() => openDeleteModal()}
							title="Eliminar todos los resultados"
							disabled={filteredResults.length === 0 || !canDeleteResults}
						>
							<Trash2 size={16} class="mr-1" />
						</button>
						<span class="text-sm opacity-70">{filteredResults.length} estudiantes</span>
					</div>

					<div class="relative w-full sm:w-auto flex-1 sm:flex-none sm:min-w-[300px]">
						<div class="join w-full">
							<input
								type="text"
								placeholder="Buscar estudiante..."
								class="input input-bordered join-item w-full"
								bind:value={searchQuery}
							/>
							<button class="btn btn-primary join-item">
								<Search size={18} />
							</button>
						</div>
					</div>
				</div>

				{#if loadingResults}
					<div class="flex justify-center py-12">
						<span class="loading loading-spinner loading-lg text-primary"></span>
					</div>
				{:else if results.length > 0}
					{#if filteredResults.length > 0}
						<div class="overflow-x-auto">
							<Table
								columns={resultColumns}
								rows={paginatedResults}
								striped={true}
								hover={true}
								bordered={true}
								emptyMessage="No hay resultados para mostrar."
							/>

							<!-- Paginación -->
							<Pagination {currentPage} {totalPages} onPageChange={goToPage} />
						</div>
					{:else if searchQuery}
						<div
							class="bg-base-100/50 rounded-lg border border-base-300/30 p-8 w-full max-w-md mx-auto text-center"
						>
							<Search size={48} class="text-primary/30 mx-auto mb-4" />
							<h3 class="text-lg font-bold mb-2">Sin resultados</h3>
							<p class="text-base-content/70 mb-4">
								No se encontraron estudiantes que coincidan con la búsqueda "{searchQuery}".
							</p>
						</div>
					{/if}
				{:else}
					<div
						class="bg-base-100/50 rounded-lg border border-base-300/30 p-8 w-full max-w-md mx-auto text-center"
					>
						<School size={48} class="text-primary/30 mx-auto mb-4" />
						<h3 class="text-lg font-bold mb-2">Sin resultados</h3>
						<p class="text-base-content/70 mb-4">
							No hay resultados disponibles para esta evaluación.
						</p>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div
			class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl"
		>
			<div class="card-body flex flex-col items-center justify-center p-8 text-center">
				<div class="bg-base-100/50 rounded-lg border border-base-300/30 p-8 w-full max-w-md">
					<School size={64} class="text-primary/30 mx-auto mb-4" />
					<h3 class="text-lg font-bold mb-2">Selecciona una evaluación</h3>
					<p class="text-base-content/70 mb-4">
						Para ver los resultados, primero debes seleccionar una evaluación.
					</p>
				</div>
			</div>
		</div>
	{/if}
</main>

<EvalSelector
	levels={data.levels}
	availableEvals={storeState.availableEvals}
	selectedEval={storeState.selectedEval}
	selectedLevelCode={storeState.selectedLevelCode}
	open={evalSelectionModalOpen}
	loading={storeState.isLoading}
	onClose={() => (evalSelectionModalOpen = false)}
	onLevelChange={(levelCode) => evaluationStore.setLevelCode(levelCode, 'result-page')}
	onSelectEval={(eval_item) => evaluationStore.setSelectedEval(eval_item)}
/>

<!-- Delete Confirmation Modal -->
<dialog class="modal modal-bottom sm:modal-middle" class:modal-open={deleteModalOpen}>
	<div class="modal-box">
		<h3 class="font-bold text-lg flex items-center gap-2">
			<AlertTriangle class="text-error" size={24} />
			Confirmar eliminación
		</h3>
		{#if deleteAllMode}
			<p class="py-4">
				¿Estás seguro de que deseas eliminar <strong>todos los resultados</strong> de esta evaluación?
				Esta acción no se puede deshacer.
			</p>
		{:else if resultToDelete}
			<p class="py-4">
				¿Estás seguro de que deseas eliminar el resultado de
				<strong>{resultToDelete.name} {resultToDelete.last_name}</strong>? Esta acción no se puede
				deshacer.
			</p>
		{/if}
		<div class="modal-action">
			<button class="btn btn-ghost" onclick={closeDeleteModal} disabled={isDeleting}
				>Cancelar</button
			>
			<button class="btn btn-error" onclick={confirmDelete} disabled={isDeleting}>
				{#if isDeleting}
					<span class="loading loading-spinner loading-xs"></span>
					Eliminando...
				{:else}
					Eliminar
				{/if}
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={closeDeleteModal}>cerrar</button>
	</form>
</dialog>
