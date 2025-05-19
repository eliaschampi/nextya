<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { User, X, Search, ListChecks, SortAsc, SortDesc, FileDown } from 'lucide-svelte';
	import type { Student, StudentRegister, StudentResult, SortOrder } from '$lib/types';
	import type { TableColumn } from '$lib/types/table';
	import { onMount, onDestroy } from 'svelte';
	import { formatDate } from '$lib/utils/formatDate';
	import { goto } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import Table from '$lib/components/Table.svelte';
	import { permissionsStore } from '$lib/stores/permissions';
	import { studentStore } from '$lib/stores/student';

	// Define EventListener type for custom events
	type EventListener = (event: Event) => void;

	// Referencias y estados
	let modal = $state<HTMLDialogElement | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<Student[]>([]);
	let searchLoading = $state(false);

	// Store state
	let storeState = $state({
		selectedStudent: null as Student | null,
		registers: [] as StudentRegister[],
		results: [] as StudentResult[],
		selectedRegister: null as string | null,
		isLoading: false
	});

	// Subscribe to the store
	$effect(() => {
		const unsubscribe = studentStore.subscribe((state) => {
			storeState = state;
		});
		return unsubscribe;
	});

	// Local state for pagination and search
	let sortOrder = $state<SortOrder>('desc');
	let currentPage = $state(1);
	const itemsPerPage = 10;
	let resultsSearchQuery = $state('');

	// Computed values
	let filteredByRegister = $derived(
		storeState.results.filter(
			(r: StudentResult) =>
				!storeState.selectedRegister || r.register_code === storeState.selectedRegister
		)
	);

	// Filter by search query
	let filteredResults = $derived(
		filteredByRegister.filter((result: StudentResult) => {
			if (!resultsSearchQuery.trim()) return true;

			const query = resultsSearchQuery.toLowerCase();
			return (
				result.eval_name?.toLowerCase().includes(query) ||
				formatDate(result.eval_date).toLowerCase().includes(query) ||
				result.score.toString().includes(query)
			);
		})
	);

	let totalPages = $derived(Math.ceil(filteredResults.length / itemsPerPage));
	let paginatedResults = $derived(
		filteredResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
	);

	// Props del servidor
	const { data } = $props<{
		data: {
			title: string;
			studentCode: string | null;
		};
	}>();

	// Permissions
	const canViewDetails = permissionsStore.has({ entity: 'eval_results', action: 'read' });

	// Define table columns
	const resultColumns: TableColumn<StudentResult>[] = [
		{
			label: 'Fecha',
			cell: (row: StudentResult) => formatDate(row.eval_date)
		},
		{
			label: 'Evaluación',
			key: 'eval_name',
			class: 'font-medium'
		},
		{
			label: 'Preguntas',
			class: 'text-center',
			cell: (row: StudentResult) => row.correct_count + row.incorrect_count + row.blank_count
		},
		{
			label: 'Correctas',
			key: 'correct_count',
			class: 'text-center text-success font-medium'
		},
		{
			label: 'Incorrectas',
			key: 'incorrect_count',
			class: 'text-center text-error font-medium'
		},
		{
			label: 'En blanco',
			key: 'blank_count',
			class: 'text-center opacity-70'
		},
		{
			label: 'Nota',
			class: 'text-center font-bold',
			cell: (row: StudentResult) => `
				<span class="badge badge-lg ${row.score >= 10.5 ? 'badge-success' : 'badge-error'}">
					${row.score.toFixed(2)}
				</span>
			`
		},
		{
			label: 'Acciones',
			class: 'text-center',
			cell: (row: StudentResult) => {
				const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye w-4 h-4 mr-1"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

				return `
					<button
						class="btn btn-sm btn-primary btn-outline ${!$canViewDetails ? 'btn-disabled' : ''}"
						onclick="document.dispatchEvent(new CustomEvent('view-result', {detail: '${row.result_code}'}))"
						title="Ver detalles"
						${!$canViewDetails ? 'disabled' : ''}
					>
						${eyeIcon} Ver
					</button>
				`;
			}
		}
	];

	// Initialize the store from URL parameters or session storage
	$effect(() => {
		// Check if we have stored state from a previous navigation
		try {
			const storedState = sessionStorage.getItem('student_page_state');
			if (storedState) {
				const state = JSON.parse(storedState);
				const isRecent = Date.now() - state.timestamp < 5 * 60 * 1000; // 5 minutes

				if (isRecent && state.studentCode) {
					// Clear the stored state to avoid using it again
					sessionStorage.removeItem('student_page_state');

					// If the stored state matches the URL parameters, use it
					if (state.studentCode === data.studentCode) {
						studentStore.initFromStudentCode(state.studentCode, 'eval-student-page');
						return;
					}
				}
			}
		} catch (e) {
			console.error('Error reading from sessionStorage:', e);
		}

		// Normal flow if no stored state or stored state is invalid
		if (data.studentCode) {
			studentStore.initFromStudentCode(data.studentCode, 'eval-student-page');
		}
	});

	function openStudentSearchModal() {
		modal?.showModal();
		// Enfocar el campo de búsqueda
		queueMicrotask(() => {
			const searchInput = modal?.querySelector<HTMLInputElement>('#student-search');
			searchInput?.focus();
		});
	}

	// Cerrar modal
	function closeModal() {
		modal?.close();
	}

	// Manejar tecla Enter
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			searchStudents();
		}
	}

	// Buscar estudiantes
	async function searchStudents() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}

		searchLoading = true;
		try {
			const response = await fetch(`/api/student?search=${encodeURIComponent(searchQuery)}`);
			if (response.ok) {
				searchResults = await response.json();
			} else {
				searchResults = [];
			}
		} catch (error) {
			console.error('Error searching students:', error);
			searchResults = [];
		} finally {
			searchLoading = false;
		}
	}

	// Seleccionar estudiante
	async function handleSelectStudent(student: Student) {
		closeModal();

		// Use SvelteKit's goto to update the URL
		goto(`/eval/student?student=${student.code}`, {
			keepFocus: true,
			noScroll: true,
			replaceState: true
		});

		// Load student data using the store
		await studentStore.selectStudent(student, 'eval-student-page');

		// Reset pagination when selecting a new student
		currentPage = 1;

		// Sort results by date
		studentStore.sortResults(sortOrder);
	}

	// Funciones para manejar resultados
	function toggleSortOrder() {
		sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
		studentStore.sortResults(sortOrder);
	}

	function filterByRegister(registerCode: string | null) {
		studentStore.setSelectedRegister(registerCode);
		currentPage = 1;
	}

	function viewResultDetails(result: StudentResult) {
		// Store current state in sessionStorage for better back navigation
		try {
			if (storeState.selectedStudent) {
				sessionStorage.setItem(
					'student_page_state',
					JSON.stringify({
						studentCode: storeState.selectedStudent.code,
						timestamp: Date.now()
					})
				);
			}
		} catch (e) {
			console.error('Error storing state in sessionStorage:', e);
		}

		// Redirect to the eval/answer page with fromPage parameter
		goto(
			`/eval/answer/${result.result_code}?from=eval/student&student=${storeState.selectedStudent?.code}`
		);
	}

	function goToPage(pageNum: number) {
		if (pageNum >= 1 && pageNum <= totalPages) {
			currentPage = pageNum;
		}
	}

	function resetSearch() {
		searchQuery = '';
		searchResults = [];
	}

	// Exportar resultados a Excel
	async function exportToExcel() {
		if (!storeState.selectedStudent) return;

		try {
			showToast('Preparando exportación...', 'info');

			// Use the browser's fetch API to download the file
			const response = await fetch(
				`/api/impcsv/student?student_code=${storeState.selectedStudent.code}`,
				{
					method: 'GET'
				}
			);

			if (!response.ok) {
				throw new Error('Error al exportar resultados');
			}

			// Get the filename from the Content-Disposition header or use a default
			const contentDisposition = response.headers.get('Content-Disposition');
			let filename = 'evaluaciones.csv';

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

			showToast('Evaluaciones exportadas correctamente', 'success');
		} catch (error) {
			console.error('Error exportando evaluaciones:', error);
			showToast('No se pudieron exportar las evaluaciones', 'danger');
		}
	}

	// Event handlers for custom events from table
	function setupTableEventListeners() {
		const handleViewResult = (event: CustomEvent) => {
			const resultCode = event.detail;
			const result = storeState.results.find((r: StudentResult) => r.result_code === resultCode);
			if (result) {
				viewResultDetails(result);
			}
		};

		document.addEventListener('view-result', handleViewResult as EventListener);

		return () => {
			document.removeEventListener('view-result', handleViewResult as EventListener);
		};
	}

	onMount(() => {
		modal?.addEventListener('close', resetSearch);
		const cleanup = setupTableEventListeners();
		return () => cleanup();
	});

	onDestroy(() => {
		modal?.removeEventListener('close', resetSearch);
		// Asegurarse de que el modal esté cerrado al desmontar
		if (modal?.open) {
			modal.close();
		}
	});
</script>

<PageTitle
	title={storeState.selectedStudent
		? `Informe de ${storeState.selectedStudent.name} ${storeState.selectedStudent.last_name}`
		: 'Informe historico'}
	description="Visualiza el historial de resultados de un estudiante."
>
	<button
		class="btn btn-outline btn-primary"
		onclick={openStudentSearchModal}
		aria-label="Buscar estudiante"
	>
		<User size={20} class="mr-2" />
		{storeState.selectedStudent ? 'Cambiar Estudiante' : 'Buscar Estudiante'}
	</button>
</PageTitle>

<main class="container mx-auto p-4">
	{#if storeState.selectedStudent}
		<!-- Vista de resultados del estudiante -->
		<div
			class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl mb-6"
		>
			<div class="card-body">
				<h2 class="card-title text-primary flex items-center gap-2">
					<User size={20} />
					{storeState.selectedStudent.name}
					{storeState.selectedStudent.last_name}
				</h2>
				{#if storeState.registers.length > 0}
					<div class="flex flex-wrap gap-2 mt-2">
						<button
							class="btn btn-sm btn-primary {storeState.selectedRegister === null
								? ''
								: 'btn-outline'}"
							onclick={() => filterByRegister(null)}
						>
							Todos
						</button>
						{#each storeState.registers as register (register.code)}
							<button
								class="btn btn-sm btn-primary {storeState.selectedRegister === register.code
									? ''
									: 'btn-outline'}"
								onclick={() => filterByRegister(register.code)}
							>
								{register.levels.name} - {register.group_name}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		{#if storeState.isLoading}
			<div class="flex justify-center py-12">
				<span class="loading loading-spinner loading-lg text-primary"></span>
			</div>
		{:else if storeState.results.length > 0}
			<div
				class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl"
			>
				<div class="card-body">
					<div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
						<h3 class="text-lg font-bold flex items-center gap-2">
							<ListChecks size={20} class="text-primary" />
							Resultados ({filteredByRegister.length})
						</h3>
						<div class="flex flex-wrap gap-2 items-center">
							<div class="relative w-full sm:w-auto flex-1 sm:flex-none sm:min-w-[250px]">
								<div class="join w-full">
									<input
										type="text"
										placeholder="Buscar evaluación..."
										class="input input-bordered join-item w-full input-sm"
										bind:value={resultsSearchQuery}
									/>
									{#if resultsSearchQuery}
										<button
											class="btn btn-error join-item btn-sm"
											onclick={() => (resultsSearchQuery = '')}
											title="Limpiar búsqueda"
										>
											<X size={16} />
										</button>
									{/if}
									<button class="btn btn-primary join-item btn-sm">
										<Search size={16} />
									</button>
								</div>
							</div>
							<button
								class="btn btn-sm btn-success btn-outline"
								onclick={exportToExcel}
								title="Exportar a Excel"
								disabled={filteredByRegister.length === 0}
							>
								<FileDown size={16} class="mr-1" />
								Excel
							</button>
							<button
								class="btn btn-sm btn-primary btn-outline"
								onclick={toggleSortOrder}
								title={sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}
							>
								<span class="mr-1">Fecha</span>
								{#if sortOrder === 'desc'}
									<SortDesc size={16} />
								{:else}
									<SortAsc size={16} />
								{/if}
							</button>
						</div>
					</div>

					{#if filteredByRegister.length > 0}
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
							</div>

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
										{#each Array.from({ length: totalPages }, (_, i) => i + 1) as pageNum (pageNum)}
											<button
												class="join-item btn btn-sm {currentPage === pageNum
													? 'btn-primary'
													: 'btn-outline'}"
												onclick={() => goToPage(pageNum)}
											>
												{pageNum}
											</button>
										{/each}
										<button
											class="join-item btn btn-sm btn-primary btn-outline {currentPage ===
											totalPages
												? 'btn-disabled'
												: ''}"
											onclick={() => goToPage(currentPage + 1)}
										>
											»
										</button>
									</div>
								</div>
							{/if}
						{:else if resultsSearchQuery}
							<div
								class="bg-base-100/50 rounded-lg border border-base-300/30 p-8 w-full max-w-md mx-auto text-center"
							>
								<Search size={48} class="text-primary/30 mx-auto mb-4" />
								<h3 class="text-lg font-bold mb-2">Sin resultados</h3>
								<p class="text-base-content/70 mb-4">
									No se encontraron evaluaciones que coincidan con la búsqueda "{resultsSearchQuery}".
								</p>
								<button class="btn btn-primary btn-sm" onclick={() => (resultsSearchQuery = '')}>
									Limpiar búsqueda
								</button>
							</div>
						{/if}
					{:else}
						<div
							class="bg-base-100/50 rounded-lg border border-base-300/30 p-8 w-full max-w-md mx-auto text-center"
						>
							<ListChecks size={48} class="text-primary/30 mx-auto mb-4" />
							<h3 class="text-lg font-bold mb-2">Sin resultados</h3>
							<p class="text-base-content/70 mb-4">
								No hay resultados disponibles para este registro.
							</p>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div
				class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl"
			>
				<div class="card-body flex flex-col items-center justify-center py-12">
					<ListChecks size={64} class="text-primary/30 mb-4" />
					<h3 class="text-lg font-bold mb-2">No hay resultados disponibles</h3>
					<p class="text-base-content/70 mb-4 text-center">
						{storeState.selectedRegister
							? 'No hay resultados para el registro seleccionado.'
							: 'Este estudiante no tiene resultados de evaluaciones registrados.'}
					</p>
				</div>
			</div>
		{/if}
	{:else}
		<!-- Vista de selección de estudiante -->
		<div class="flex justify-center items-center py-16">
			<div
				class="bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl p-8 w-full max-w-md"
			>
				<User size={64} class="text-primary/30 mx-auto mb-4" />
				<h3 class="text-lg font-bold mb-2 text-center">Selecciona un estudiante</h3>
				<p class="text-base-content/70 mb-4 text-center">
					Para ver el historial de resultados, primero debes seleccionar un estudiante.
				</p>
			</div>
		</div>
	{/if}
</main>

<!-- Modal de búsqueda de estudiantes -->
<dialog bind:this={modal} class="modal">
	<div class="modal-box max-w-md">
		<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={closeModal}>
			<X size={20} />
		</button>
		<h3 class="font-bold text-lg mb-4 flex items-center gap-2">
			<User size={20} />
			Buscar Estudiante
		</h3>

		<div class="join w-full mb-4">
			<input
				id="student-search"
				type="text"
				placeholder="Buscar por nombre o apellido"
				class="input input-bordered join-item flex-1"
				bind:value={searchQuery}
				onkeydown={handleKeyDown}
				autocomplete="off"
			/>
			<button
				class="btn btn-primary join-item"
				onclick={searchStudents}
				disabled={!searchQuery.trim() || searchLoading}
			>
				{#if searchLoading}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Search size={16} />
				{/if}
			</button>
		</div>

		{#if searchResults.length > 0}
			<ul class="space-y-2 max-h-64 overflow-y-auto">
				{#each searchResults as student (student.code)}
					<li
						class="bg-base-200 p-3 rounded-box hover:bg-base-300 transition-colors cursor-pointer"
					>
						<button
							class="w-full text-left"
							onclick={() => handleSelectStudent(student)}
							type="button"
						>
							<div class="font-medium">{student.name} {student.last_name}</div>
						</button>
					</li>
				{/each}
			</ul>
		{:else if searchQuery && !searchLoading}
			<Message
				description="No se encontraron estudiantes con ese criterio de búsqueda."
				type="info"
			/>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>cerrar</button>
	</form>
</dialog>
