<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { Eye, ListChecks, SortAsc, SortDesc, User } from 'lucide-svelte';
	import type { Student, StudentRegister, StudentResult, SortOrder } from '$lib/types';
	import { formatDate } from '$lib/utils/formatDate';
	import { goto } from '$app/navigation';

	// Props from server
	const { data } = $props<{
		data: {
			student: Student;
			levels: { code: string; name: string }[];
			title: string;
		};
	}>();

	// State
	let registers = $state<StudentRegister[]>([]);
	let results = $state<StudentResult[]>([]);
	let loading = $state(true);
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

	// Load student results on mount
	$effect(() => {
		if (data.student?.code) {
			loadStudentResults(data.student.code);
		}
	});

	async function loadStudentResults(studentCode: string) {
		loading = true;
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
			loading = false;
		}
	}

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
		goto(`/eval_answer/${result.result_code}`);
	}

	function goToPage(pageNum: number) {
		if (pageNum >= 1 && pageNum <= totalPages) {
			currentPage = pageNum;
		}
	}
</script>

<PageTitle
	title={data.student
		? `Resultados de ${data.student.name} ${data.student.last_name}`
		: 'Resultados de Estudiante'}
	description="Historial de resultados de evaluaciones del estudiante."
>
	<span></span>
</PageTitle>

<main class="container mx-auto p-4">
	{#if data.student}
		<div class="card bg-base-100 shadow-lg mb-6 border border-base-300/30">
			<div class="card-body">
				<h2 class="card-title text-primary flex items-center gap-2">
					<User size={20} />
					{data.student.name}
					{data.student.last_name}
				</h2>
				<p class="text-sm opacity-70">{data.student.email || 'Sin correo electrónico'}</p>

				{#if registers.length > 0}
					<div class="flex flex-wrap gap-2 mt-2">
						<button
							class="btn btn-sm {selectedRegister === null ? 'btn-primary' : 'btn-outline'}"
							onclick={() => filterByRegister(null)}
						>
							Todos
						</button>
						{#each registers as register (register.code)}
							<button
								class="btn btn-sm {selectedRegister === register.code
									? 'btn-primary'
									: 'btn-outline'}"
								onclick={() => filterByRegister(register.code)}
							>
								{register.levels.name} - {register.group_name} ({register.roll_code})
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		{#if loading}
			<div class="flex justify-center py-12">
				<span class="loading loading-spinner loading-lg text-primary"></span>
			</div>
		{:else if filteredResults.length > 0}
			<div class="card bg-base-100 shadow-lg border border-base-300/30">
				<div class="card-body">
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-lg font-bold flex items-center gap-2">
							<ListChecks size={20} class="text-primary" />
							Resultados ({filteredResults.length})
						</h3>
						<button
							class="btn btn-sm btn-ghost btn-circle"
							onclick={toggleSortOrder}
							title={sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}
						>
							{#if sortOrder === 'desc'}
								<SortDesc size={18} />
							{:else}
								<SortAsc size={18} />
							{/if}
						</button>
					</div>

					<div class="overflow-x-auto">
						<table class="table table-zebra table-pin-rows">
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
									<tr class="hover">
										<td>{formatDate(result.eval_date)}</td>
										<td class="font-medium">{result.eval_name}</td>
										<td class="text-center">
											{result.correct_count + result.incorrect_count + result.blank_count}
										</td>
										<td class="text-center text-success font-medium">{result.correct_count}</td>
										<td class="text-center text-error font-medium">{result.incorrect_count}</td>
										<td class="text-center opacity-70">{result.blank_count}</td>
										<td class="text-center font-bold">
											<span
												class="badge badge-lg {result.score >= 10.5
													? 'badge-success'
													: 'badge-error'}"
											>
												{result.score.toFixed(1)}
											</span>
										</td>
										<td class="text-center">
											<button
												class="btn btn-sm btn-ghost btn-circle"
												onclick={() => viewResultDetails(result)}
												title="Ver detalles"
											>
												<Eye size={16} />
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					{#if totalPages > 1}
						<div class="flex justify-center mt-4">
							<div class="join">
								<button
									class="join-item btn btn-sm"
									onclick={() => goToPage(currentPage - 1)}
									disabled={currentPage === 1}
								>
									«
								</button>
								{#each Array.from({ length: totalPages }, (_, i) => i + 1) as pageNum (pageNum)}
									<button
										class="join-item btn btn-sm {currentPage === pageNum ? 'btn-active' : ''}"
										onclick={() => goToPage(pageNum)}
									>
										{pageNum}
									</button>
								{/each}
								<button
									class="join-item btn btn-sm"
									onclick={() => goToPage(currentPage + 1)}
									disabled={currentPage === totalPages}
								>
									»
								</button>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="card bg-base-100 shadow-lg border border-base-300/30">
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
		<div class="alert alert-error">
			<div>
				<span>No se encontró información del estudiante.</span>
			</div>
		</div>
	{/if}
</main>
