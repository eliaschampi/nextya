<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import EvaluationSelectionModal from '$lib/components/EvaluationSelectionModal.svelte';
	import EvalHeader from '$lib/components/EvalHeader.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { Eye, School, Search, SortAsc, SortDesc } from 'lucide-svelte';
	import type { EvalWithSections, ResultItem } from '$lib/types';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

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

		// Update URL with level parameter
		const url = new URL(window.location.href);
		url.searchParams.set('level', selectedLevelCode);
		if (!data.evalCode) {
			url.searchParams.delete('eval');
		}
		window.history.pushState({}, '', url);

		loadingEvals = true;
		try {
			const response = await fetch(`/api/eval/${selectedLevelCode}`);
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

		// Update URL without reloading the page
		const url = new URL(window.location.href);
		url.searchParams.set('level', selectedLevelCode);
		url.searchParams.set('eval', eval_item.code);
		window.history.pushState({}, '', url);

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
		// Redirect to the eval_answer page
		goto(`/eval_answer/${result.result_code}`);
	}

	// Effects
	$effect(() => {
		if (selectedLevelCode) loadEvaluationsByLevel();
		else availableEvals = [];
	});

	// Load evaluation from URL parameters if available
	$effect(() => {
		if (data.levelCode && data.evalCode) {
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
			class="card bg-gradient-to-br from-base-200 to-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-base-300/30 rounded-xl mb-6"
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
				{:else if filteredResults.length > 0}
					<div class="overflow-x-auto">
						<table class="table table-zebra w-full">
							<thead>
								<tr>
									<th class="w-24">Código</th>
									<th>Nombre</th>
									<th>Apellidos</th>
									<th class="text-center">Grupo</th>
									<th class="text-center">Correctas</th>
									<th class="text-center">Incorrectas</th>
									<th class="text-center">En blanco</th>
									<th class="text-center">Nota</th>
									<th class="text-center">Acciones</th>
								</tr>
							</thead>
							<tbody>
								{#each paginatedResults as result (result.result_code)}
									<tr
										class="hover:bg-base-300 transition-colors border-b border-base-300 cursor-pointer"
										onclick={() => viewStudentDetails(result)}
									>
										<td class="py-3 px-4 font-mono text-accent font-medium">{result.roll_code}</td>
										<td class="py-3 px-4 font-medium">{result.name}</td>
										<td class="py-3 px-4">{result.last_name}</td>
										<td class="py-3 px-4 text-center">
											<span class="badge badge-secondary">{result.group_name}</span>
										</td>
										<td class="py-3 px-4 text-center text-success font-medium"
											>{result.correct_count}</td
										>
										<td class="py-3 px-4 text-center text-error font-medium"
											>{result.incorrect_count}</td
										>
										<td class="py-3 px-4 text-center opacity-70">{result.blank_count}</td>
										<td class="py-3 px-4 text-center font-bold">
											<span
												class="badge badge-lg {result.score >= 10.5
													? 'badge-success'
													: 'badge-error'}"
											>
												{result.score.toFixed(1)}
											</span>
										</td>
										<td class="py-3 px-4 text-center" onclick={(e) => e.stopPropagation()}>
											<button
												class="btn btn-sm btn-primary btn-outline"
												onclick={() => viewStudentDetails(result)}
												title="Ver detalles"
											>
												<Eye size={16} class="mr-1" /> Ver
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>

						<!-- Paginación -->
						{#if totalPages > 1}
							<div class="flex justify-center mt-6">
								<div class="join">
									<button
										class="join-item btn btn-sm btn-primary btn-outline {currentPage === 1
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
												: 'btn-outline'}"
											onclick={() => goToPage(pageNum)}
										>
											{pageNum}
										</button>
									{/each}

									<button
										class="join-item btn btn-sm btn-primary btn-outline {currentPage === totalPages
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
			class="card bg-gradient-to-br from-base-200 to-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-base-300/30 rounded-xl"
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
