<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import EvaluationSelectionModal from '$lib/components/EvaluationSelectionModal.svelte';
	import EvalHeader from '$lib/components/EvalHeader.svelte';
	import Table from '$lib/components/Table.svelte';
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
	// Define EventListener type
	type EventListener = (event: Event) => void;
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { permissionsStore } from '$lib/stores/permissions';

	// Props from server
	const { data } = $props<{
		data: {
			levels: { code: string; name: string }[];
			levelCode: string | null;
			evalCode: string | null;
		};
	}>();

	// State variables
	let selectedLevelCode = $state(data.levelCode || '');
	let availableEvals = $state<EvalWithSections[]>([]);
	let selectedEval = $state<EvalWithSections | null>(null);
	let evalSelectionModalOpen = $state(false);
	let loadingEvals = $state(false);
	let loadingResults = $state(false);
	let results = $state<ResultItem[]>([]);
	let sortOrder = $state<'asc' | 'desc'>('desc'); // Default sort by highest score
	let searchQuery = $state('');

	// Permissions
	const canViewDetails = permissionsStore.has({ entity: 'eval_results', action: 'read' });
	const canDeleteResults = permissionsStore.has({ entity: 'eval_results', action: 'delete' });

	// Delete state
	let deleteModalOpen = $state(false);
	let resultToDelete = $state<ResultItem | null>(null);
	let deleteAllMode = $state(false);
	let isDeleting = $state(false);

	// Caché de resultados por evaluación
	const resultsCache = $state<Record<string, { data: ResultItem[]; timestamp: number }>>({});
	// TTL de caché: 5 minutos
	const CACHE_TTL = 5 * 60 * 1000;

	// Estado para paginación
	let currentPage = $state(1);
	let pageSize = $state(20); // Resultados por página

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

	async function loadEvaluationsByLevel() {
		if (!selectedLevelCode) {
			availableEvals = [];
			return;
		}

		// Use SvelteKit's goto to update the URL
		goto(`/result?level=${selectedLevelCode}${data.evalCode ? `&eval=${data.evalCode}` : ''}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});

		loadingEvals = true;
		try {
			const response = await fetch(`/api/eval/${selectedLevelCode}`);
			if (!response.ok) {
				throw new Error('Error al cargar evaluaciones');
			}
			availableEvals = await response.json();
		} catch (error) {
			console.error('Error cargando evaluaciones:', error);
			showToast('No se pudieron cargar las evaluaciones', 'danger');
			availableEvals = [];
		} finally {
			loadingEvals = false;
		}
	}

	async function selectEval(eval_item: EvalWithSections) {
		selectedEval = eval_item;

		// Use SvelteKit's goto to update the URL
		goto(`/result?level=${selectedLevelCode}&eval=${eval_item.code}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});

		await loadResults(eval_item.code);
	}

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
					levelCode: selectedLevelCode,
					evalCode: selectedEval?.code,
					timestamp: Date.now()
				})
			);
		} catch (e) {
			console.error('Error storing state in sessionStorage:', e);
		}

		// Redirect to the eval/answer page with fromPage parameter
		goto(
			`/eval/answer/${result.result_code}?from=result&level=${selectedLevelCode}&eval=${selectedEval?.code}`
		);
	}

	async function exportToExcel() {
		if (!selectedEval) return;

		try {
			showToast('Preparando exportación...', 'info');

			// Use the browser's fetch API to download the file
			const response = await fetch(`/api/impcsv/export?eval_code=${selectedEval.code}`, {
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
		if (!selectedEval) return;

		isDeleting = true;
		try {
			const resultIds = deleteAllMode ? [] : resultToDelete ? [resultToDelete.result_code] : [];

			const response = await fetch(`/api/eval/results/${selectedEval.code}`, {
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
				delete resultsCache[selectedEval.code];
				results = [];
			} else if (resultToDelete) {
				// Remove single item from results
				results = results.filter((r) => r.result_code !== resultToDelete?.result_code);

				// Update cache
				if (resultsCache[selectedEval.code]) {
					resultsCache[selectedEval.code].data = results;
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

	// Effects
	$effect(() => {
		// Check if we have stored state from a previous navigation
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
						selectedLevelCode = state.levelCode;
						loadEvaluationsByLevel();
						return;
					}
				}
			}
		} catch (e) {
			console.error('Error reading from sessionStorage:', e);
		}

		// Normal flow if no stored state or stored state is invalid
		if (selectedLevelCode) loadEvaluationsByLevel();
		else availableEvals = [];
	});

	// Load evaluation from URL parameters if available
	$effect(() => {
		if (data.levelCode && data.evalCode && availableEvals.length > 0) {
			// Find the evaluation in the available evaluations
			const evalItem = availableEvals.find((e) => e.code === data.evalCode);
			if (evalItem) {
				selectEval(evalItem);
			}
		}
	});

	// Initial load from URL parameters
	onMount(() => {
		if (data.levelCode && data.evalCode && selectedLevelCode) {
			loadEvaluationsByLevel();
		}
	});

	// Define table columns
	const resultColumns: TableColumn<ResultItem>[] = [
		{ key: 'roll_code', label: 'Código', class: 'font-mono text-accent font-medium' },
		{ key: 'name', label: 'Nombre', class: 'font-medium' },
		{ key: 'last_name', label: 'Apellidos' },
		{
			key: 'group_name',
			label: 'Grupo',
			class: 'text-center',
			cell: (row: ResultItem) => `<span class="badge badge-secondary">${row.group_name}</span>`
		},
		{
			key: 'correct_count',
			label: 'Correctas',
			class: 'text-center text-success font-medium'
		},
		{
			key: 'incorrect_count',
			label: 'Incorrectas',
			class: 'text-center text-error font-medium'
		},
		{
			key: 'blank_count',
			label: 'En blanco',
			class: 'text-center opacity-70'
		},
		{
			key: 'score',
			label: 'Nota',
			class: 'text-center font-bold',
			cell: (row: ResultItem) => `
				<span class="badge badge-lg ${row.score >= 10.5 ? 'badge-success' : 'badge-error'}">
					${row.score.toFixed(1)}
				</span>
			`
		},
		{
			label: 'Acciones',
			class: 'text-center',
			cell: (row: ResultItem) => {
				const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye w-4 h-4 mr-1"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
				const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2 w-4 h-4 mr-1"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

				return `
					<div class="flex gap-2 justify-center">
						<button
							class="btn btn-sm btn-primary btn-outline ${!$canViewDetails ? 'btn-disabled' : ''}"
							onclick="document.dispatchEvent(new CustomEvent('view-result', {detail: '${row.result_code}'}))"
							title="Ver detalles"
							${!$canViewDetails ? 'disabled' : ''}
						>
							${eyeIcon}
						</button>
						<button
							class="btn btn-sm btn-error btn-outline ${!$canDeleteResults ? 'btn-disabled' : ''}"
							onclick="document.dispatchEvent(new CustomEvent('delete-result', {detail: '${row.result_code}'}))"
							title="Eliminar resultado"
							${!$canDeleteResults ? 'disabled' : ''}
						>
							${trashIcon}
						</button>
					</div>
				`;
			}
		}
	];

	// Event handlers for custom events from table
	function setupTableEventListeners() {
		const handleViewResult = (event: CustomEvent) => {
			const resultCode = event.detail;
			const result = results.find((r) => r.result_code === resultCode);
			if (result) {
				viewStudentDetails(result);
			}
		};

		const handleDeleteResult = (event: CustomEvent) => {
			const resultCode = event.detail;
			const result = results.find((r) => r.result_code === resultCode);
			if (result) {
				openDeleteModal(result);
			}
		};

		document.addEventListener('view-result', handleViewResult as EventListener);
		document.addEventListener('delete-result', handleDeleteResult as EventListener);

		return () => {
			document.removeEventListener('view-result', handleViewResult as EventListener);
			document.removeEventListener('delete-result', handleDeleteResult as EventListener);
		};
	}

	onMount(() => {
		const cleanup = setupTableEventListeners();
		return () => cleanup();
	});
</script>

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
		{selectedEval ? `${selectedEval.name}` : 'Seleccionar'}
	</button>
</PageTitle>

<main class="container mx-auto p-4">
	{#if selectedEval}
		<div class="mb-6">
			<EvalHeader evaluation={selectedEval} />
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
							disabled={filteredResults.length === 0 || !$canDeleteResults}
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
								columns={resultColumns as unknown as {
									key?: string;
									label: string;
									headerClass?: string;
									class?: string;
									cell?: (row: unknown) => unknown;
								}[]}
								rows={paginatedResults as unknown[]}
								striped={true}
								hover={true}
								bordered={true}
								emptyMessage="No hay resultados para mostrar."
							/>

							<!-- Paginación -->
							{#if totalPages > 1}
								<div class="flex justify-center mt-6">
									<div class="join">
										<button
											class="join-item btn btn-sm btn-primary btn-soft {currentPage === 1
												? 'btn-disabled'
												: ''}"
											onclick={() => goToPage(currentPage - 1)}
										>
											«
										</button>

										{#each Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
											return index + 1 + Math.max(0, Math.min(totalPages - 5, currentPage - 3));
										}) as pageNum (pageNum)}
											<button
												class="join-item btn btn-sm {pageNum === currentPage
													? 'btn-primary'
													: 'btn-soft'}"
												onclick={() => goToPage(pageNum)}
											>
												{pageNum}
											</button>
										{/each}

										<button
											class="join-item btn btn-sm btn-primary btn-soft {currentPage === totalPages
												? 'btn-disabled'
												: ''}"
											onclick={() => goToPage(currentPage + 1)}
										>
											»
										</button>
									</div>
								</div>
							{/if}
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

<EvaluationSelectionModal
	levels={data.levels}
	{availableEvals}
	{selectedEval}
	{selectedLevelCode}
	open={evalSelectionModalOpen}
	loading={loadingEvals}
	onClose={() => (evalSelectionModalOpen = false)}
	onLevelChange={(levelCode) => {
		selectedLevelCode = levelCode;
		loadEvaluationsByLevel();
	}}
	onSelectEval={selectEval}
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
