<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { Trophy, SortAsc, SortDesc } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import type { Levels } from '$lib/types';
	import type { StudentRanking } from '$lib/types/dashboard/ranking';

	// Props from server
	const { data } = $props<{
		data: {
			levels: Levels[];
			students: StudentRanking[];
			availableGroups: string[];
			selectedLevel: string | null;
			selectedGroup: string | null;
		};
	}>();

	// Local state
	let selectedLevelCode = $state(data.selectedLevel || '');
	let selectedGroupName = $state(data.selectedGroup || '');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	// Sorted students (only by average_score)
	const sortedStudents = $derived.by(() => {
		const students = [...data.students];
		return students.sort((a, b) => {
			const aVal = Number(a.average_score) || 0;
			const bVal = Number(b.average_score) || 0;

			if (sortDirection === 'desc') {
				return bVal - aVal;
			} else {
				return aVal - bVal;
			}
		});
	});

	// Toggle sort direction
	function toggleSortOrder() {
		sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
	}

	// Handle level change
	function handleLevelChange() {
		const params = new URLSearchParams();
		if (selectedLevelCode) {
			params.set('level', selectedLevelCode);
		}
		if (selectedGroupName && selectedLevelCode) {
			params.set('group', selectedGroupName);
		}
		goto(`/dashboard/ranking?${params.toString()}`);
	}

	// Handle group change
	function handleGroupChange() {
		const params = new URLSearchParams();
		if (selectedLevelCode) {
			params.set('level', selectedLevelCode);
		}
		if (selectedGroupName) {
			params.set('group', selectedGroupName);
		}
		goto(`/dashboard/ranking?${params.toString()}`);
	}
</script>

<PageTitle
	title="Ranking de Estudiantes"
	description="Estudiantes ordenados por promedio de calificaciones"
>
	<div></div>
</PageTitle>

<!-- Filters Section -->
<div class="data-display flex flex-col sm:flex-row items-center gap-4 mb-6">
	<select
		class="select w-full sm:w-auto"
		bind:value={selectedLevelCode}
		onchange={handleLevelChange}
	>
		<option value="">Selecciona un nivel</option>
		{#each data.levels as level (level.code)}
			<option value={level.code}>{level.name}</option>
		{/each}
	</select>

	<select
		class="select w-full sm:w-auto"
		bind:value={selectedGroupName}
		onchange={handleGroupChange}
		disabled={!selectedLevelCode || data.availableGroups.length === 0}
	>
		<option value="">Selecciona un grupo</option>
		{#each data.availableGroups as group (group)}
			<option value={group}>Grupo {group}</option>
		{/each}
	</select>
</div>

<!-- Ranking Table -->
{#if data.students.length > 0}
	<div class="card card-gradient-neutral rounded-xl overflow-hidden">
		<div class="card-body p-4">
			<div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
				<div class="flex items-center gap-3">
					<Trophy class="w-6 h-6 text-primary" />
					<h3 class="text-xl font-semibold">Ranking de Estudiantes</h3>
				</div>
				<button
					class="btn btn-sm btn-primary btn-outline"
					onclick={toggleSortOrder}
					title={sortDirection === 'desc'
						? 'Ordenar por promedio menor'
						: 'Ordenar por promedio mayor'}
				>
					<span class="mr-1">Promedio</span>
					{#if sortDirection === 'desc'}
						<SortDesc size={16} />
					{:else}
						<SortAsc size={16} />
					{/if}
				</button>
			</div>

			<div class="overflow-x-auto animate-fade-in">
				<table
					class="table table-sm table-zebra w-full hover bg-base-100/50 border border-base-300/30"
				>
					<thead class="bg-base-200/70">
						<tr>
							<th class="text-center w-16">#</th>
							<th>Código</th>
							<th>Nombre</th>
							<th>Apellido</th>
							<th class="text-center">Evaluaciones</th>
							<th class="text-center">Promedio</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedStudents as student, index (student.roll_code)}
							<tr class="hover">
								<td class="text-center">
									<div class="flex items-center justify-center">
										{#if index + 1 === 1}
											<Trophy class="w-5 h-5 text-yellow-500" />
										{:else if index + 1 === 2}
											<div
												class="w-5 h-5 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center font-bold"
											>
												2
											</div>
										{:else if index + 1 === 3}
											<div
												class="w-5 h-5 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold"
											>
												3
											</div>
										{:else}
											<span class="font-bold text-base-content/70">{index + 1}</span>
										{/if}
									</div>
								</td>
								<td class="text-accent font-medium">{student.roll_code}</td>
								<td class="font-medium">{student.name}</td>
								<td class="font-medium">{student.last_name}</td>
								<td class="text-center">{student.total_evaluations}</td>
								<td class="text-center font-bold text-primary"
									>{Number(student.average_score).toFixed(2)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
{:else}
	<div class="card card-gradient-neutral rounded-xl">
		<div class="card-body text-center py-12">
			<Trophy class="w-16 h-16 text-base-content/30 mx-auto mb-4" />
			<h3 class="text-xl font-semibold mb-2">Sin estudiantes</h3>
			<p class="text-base-content/70 max-w-md mx-auto">
				Selecciona un nivel y grupo para ver el ranking de estudiantes.
			</p>
		</div>
	</div>
{/if}
