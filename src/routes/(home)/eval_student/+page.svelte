<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { User, X, Search, Eye, ListChecks, SortAsc, SortDesc } from 'lucide-svelte';
	import type { Student, StudentRegister, StudentResult, SortOrder } from '$lib/types';
	import { onMount, onDestroy } from 'svelte';
	import { formatDate } from '$lib/utils/formatDate';
	import { goto } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import { permissionsStore } from '$lib/stores/permissions';

	// Referencias y estados
	let modal = $state<HTMLDialogElement | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<Student[]>([]);
	let searchLoading = $state(false);

	// Estados para los resultados del estudiante
	let selectedStudent = $state<Student | null>(null);
	let registers = $state<StudentRegister[]>([]);
	let results = $state<StudentResult[]>([]);
	let resultsLoading = $state(false);
	let selectedRegister = $state<string | null>(null);
	let sortOrder = $state<SortOrder>('desc');
	let currentPage = $state(1);
	const itemsPerPage = 10;

	// Computed values
	let filteredResults = $derived(
		results.filter((r) => !selectedRegister || r.register_code === selectedRegister)
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

	// Cargar estudiante si hay un código en la URL
	$effect(() => {
		if (data.studentCode) {
			loadStudentInfo(data.studentCode);
		}
	});

	// Abrir modal de búsqueda
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

		// Actualizar la URL sin recargar la página
		const url = new URL(window.location.href);
		url.searchParams.set('student', student.code);
		window.history.pushState({}, '', url);

		// Cargar información del estudiante
		await loadStudentInfo(student.code);
	}

	// Cargar información del estudiante
	async function loadStudentInfo(studentCode: string) {
		try {
			const response = await fetch(`/api/student/${studentCode}`);
			if (!response.ok) {
				throw new Error('Error al cargar información del estudiante');
			}
			const data = await response.json();
			selectedStudent = data;

			// Cargar resultados del estudiante
			loadStudentResults(studentCode);
		} catch (error) {
			console.error('Error loading student info:', error);
			showToast('No se pudo cargar la información del estudiante', 'danger');
			selectedStudent = null;
		}
	}

	// Cargar resultados del estudiante
	async function loadStudentResults(studentCode: string) {
		resultsLoading = true;
		try {
			const response = await fetch(`/api/student/results/${studentCode}`);
			if (!response.ok) {
				throw new Error('Error al cargar resultados del estudiante');
			}
			const data = await response.json();
			registers = data.registers || [];
			results = data.results || [];
			sortResults();
			currentPage = 1;
		} catch (error) {
			console.error('Error loading student results:', error);
			showToast('No se pudieron cargar los resultados del estudiante', 'danger');
			registers = [];
			results = [];
		} finally {
			resultsLoading = false;
		}
	}

	// Funciones para manejar resultados
	function toggleSortOrder() {
		sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
		sortResults();
	}

	function sortResults() {
		results = [...results].sort((a, b) => {
			if (sortOrder === 'desc') {
				return new Date(b.eval_date).getTime() - new Date(a.eval_date).getTime();
			} else {
				return new Date(a.eval_date).getTime() - new Date(b.eval_date).getTime();
			}
		});
	}

	function filterByRegister(registerCode: string | null) {
		selectedRegister = registerCode;
		currentPage = 1;
	}

	function viewResultDetails(result: StudentResult) {
		// Update URL with student parameter before redirecting
		if (selectedStudent) {
			const url = new URL(window.location.href);
			url.searchParams.set('student', selectedStudent.code);
			window.history.pushState({}, '', url);
		}

		// Redirect to the eval_answer page with fromPage parameter
		goto(`/eval_answer/${result.result_code}?from=eval_student&student=${selectedStudent?.code}`);
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

	onMount(() => {
		modal?.addEventListener('close', resetSearch);

		// Add popstate event listener to handle browser back/forward navigation
		window.addEventListener('popstate', handlePopState);

		return () => {
			window.removeEventListener('popstate', handlePopState);
		};
	});

	onDestroy(() => {
		modal?.removeEventListener('close', resetSearch);
		// Asegurarse de que el modal esté cerrado al desmontar
		if (modal?.open) {
			modal.close();
		}
	});

	// Handle browser back/forward navigation
	function handlePopState() {
		const url = new URL(window.location.href);
		const newStudentCode = url.searchParams.get('student');

		// If student code changed or was removed, update accordingly
		if (newStudentCode && (!selectedStudent || newStudentCode !== selectedStudent.code)) {
			loadStudentInfo(newStudentCode);
		} else if (!newStudentCode && selectedStudent) {
			// Reset if student parameter was removed
			selectedStudent = null;
			registers = [];
			results = [];
		}
	}
</script>

<PageTitle
	title={selectedStudent
		? `Informe de ${selectedStudent.name} ${selectedStudent.last_name}`
		: 'Informe historico'}
	description="Visualiza el historial de resultados de un estudiante."
>
	<button
		class="btn btn-outline btn-primary"
		onclick={openStudentSearchModal}
		aria-label="Buscar estudiante"
	>
		<User size={20} class="mr-2" />
		{selectedStudent ? 'Cambiar Estudiante' : 'Buscar Estudiante'}
	</button>
</PageTitle>

<main class="container mx-auto p-4">
	{#if selectedStudent}
		<!-- Vista de resultados del estudiante -->
		<div
			class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl mb-6"
		>
			<div class="card-body">
				<h2 class="card-title text-primary flex items-center gap-2">
					<User size={20} />
					{selectedStudent.name}
					{selectedStudent.last_name}
				</h2>
				{#if registers.length > 0}
					<div class="flex flex-wrap gap-2 mt-2">
						<button
							class="btn btn-sm btn-primary {selectedRegister === null ? '' : 'btn-outline'}"
							onclick={() => filterByRegister(null)}
						>
							Todos
						</button>
						{#each registers as register (register.code)}
							<button
								class="btn btn-sm btn-primary {selectedRegister === register.code
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

		{#if resultsLoading}
			<div class="flex justify-center py-12">
				<span class="loading loading-spinner loading-lg text-primary"></span>
			</div>
		{:else if filteredResults.length > 0}
			<div
				class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl"
			>
				<div class="card-body">
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-lg font-bold flex items-center gap-2">
							<ListChecks size={20} class="text-primary" />
							Resultados ({filteredResults.length})
						</h3>
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

					<div class="overflow-x-auto">
						<table class="table table-zebra w-full">
							<thead>
								<tr>
									<th>Fecha</th>
									<th>Evaluación</th>
									<th class="text-center">Preguntas</th>
									<th class="text-center">Correctas</th>
									<th class="text-center">Incorrectas</th>
									<th class="text-center">En blanco</th>
									<th class="text-center">Nota</th>
									<th class="text-center">Acciones</th>
								</tr>
							</thead>
							<tbody>
								{#each paginatedResults as result (result.result_code)}
									<tr class="hover:bg-base-300 transition-colors border-b border-base-300}">
										<td class="py-3 px-4">{formatDate(result.eval_date)}</td>
										<td class="py-3 px-4 font-medium">{result.eval_name}</td>
										<td class="py-3 px-4 text-center">
											{result.correct_count + result.incorrect_count + result.blank_count}
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
												onclick={() => viewResultDetails(result)}
												title="Ver detalles"
												disabled={!$canViewDetails}
											>
												<Eye size={16} class="mr-1" /> Ver
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
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
			</div>
		{:else}
			<div
				class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl"
			>
				<div class="card-body flex flex-col items-center justify-center py-12">
					<ListChecks size={64} class="text-primary/30 mb-4" />
					<h3 class="text-lg font-bold mb-2">No hay resultados disponibles</h3>
					<p class="text-base-content/70 mb-4 text-center">
						{selectedRegister
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
				type="warning"
			/>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>cerrar</button>
	</form>
</dialog>
