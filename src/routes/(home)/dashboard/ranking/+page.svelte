<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Table from '$lib/components/Table.svelte';
	import { Trophy, SortAsc, SortDesc } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import type { Levels } from '$lib/types';
	import type { StudentRanking } from '$lib/types/dashboard/ranking';
	import type { TableColumn } from '$lib/types/table';

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
	let sortField = $state<'average_score' | 'total_evaluations'>('average_score');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	// Toggle sort direction for current field
	function toggleSortOrder() {
		sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
	}

	// Set sort field and direction
	function setSortField(field: 'average_score' | 'total_evaluations') {
		if (sortField === field) {
			toggleSortOrder();
		} else {
			sortField = field;
			sortDirection = 'desc';
		}
	}

	// Handle level change
	function handleLevelChange() {
		const params = new SvelteURLSearchParams();
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
		const params = new SvelteURLSearchParams();
		if (selectedLevelCode) {
			params.set('level', selectedLevelCode);
		}
		if (selectedGroupName) {
			params.set('group', selectedGroupName);
		}
		goto(`/dashboard/ranking?${params.toString()}`);
	}

	// Add ranking position to students for table display with sorting
	const studentsWithRanking = $derived.by(() => {
		// Sort students by selected field and direction
		const sorted = [...data.students].sort((a, b) => {
			let aVal: number, bVal: number;

			if (sortField === 'average_score') {
				aVal = Number(a.average_score) || 0;
				bVal = Number(b.average_score) || 0;
			} else {
				aVal = Number(a.total_evaluations) || 0;
				bVal = Number(b.total_evaluations) || 0;
			}

			if (sortDirection === 'desc') {
				return bVal - aVal;
			} else {
				return aVal - bVal;
			}
		});

		// Add ranking position to each student
		return sorted.map((student, index) => ({
			...student,
			ranking_position: index + 1
		}));
	});

	// Define table columns for ranking
	const rankingColumns: TableColumn<StudentRanking & { ranking_position: number }>[] = [
		{ label: '#', headerClass: 'text-center w-16', render: rankingCell },
		{ key: 'roll_code', label: 'Código', class: 'text-accent font-medium' },
		{ key: 'name', label: 'Nombre', class: 'font-medium' },
		{ key: 'last_name', label: 'Apellido', class: 'font-medium' },
		{ key: 'total_evaluations', label: 'Evaluaciones', class: 'text-center' },
		{ label: 'Promedio', class: 'text-center font-bold text-primary', render: averageCell }
	];
</script>

<!-- Define snippets for custom cells -->
{#snippet rankingCell(row: StudentRanking & { ranking_position: number })}
	<div class="flex items-center justify-center">
		{#if row.ranking_position === 1}
			<Trophy class="w-5 h-5 text-yellow-500" />
		{:else if row.ranking_position === 2}
			<div
				class="w-5 h-5 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center font-bold"
			>
				2
			</div>
		{:else if row.ranking_position === 3}
			<div
				class="w-5 h-5 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold"
			>
				3
			</div>
		{:else}
			<span class="font-bold text-base-content/70">{row.ranking_position}</span>
		{/if}
	</div>
{/snippet}

{#snippet averageCell(row: StudentRanking)}
	{Number(row.average_score).toFixed(2)}
{/snippet}

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
				<details class="dropdown dropdown-end">
					<summary class="btn btn-sm btn-primary btn-outline">
						<span class="mr-1">
							{sortField === 'average_score' ? 'Promedio' : 'Evaluaciones'}
						</span>
						{#if sortDirection === 'desc'}
							<SortDesc size={16} />
						{:else}
							<SortAsc size={16} />
						{/if}
					</summary>
					<ul
						class="menu dropdown-content bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-300"
					>
						<li>
							<button
								class="flex justify-between {sortField === 'average_score' ? 'active' : ''}"
								onclick={() => setSortField('average_score')}
							>
								<span>Promedio</span>
								{#if sortField === 'average_score'}
									{#if sortDirection === 'desc'}
										<SortDesc size={16} />
									{:else}
										<SortAsc size={16} />
									{/if}
								{/if}
							</button>
						</li>
						<li>
							<button
								class="flex justify-between {sortField === 'total_evaluations' ? 'active' : ''}"
								onclick={() => setSortField('total_evaluations')}
							>
								<span>Evaluaciones</span>
								{#if sortField === 'total_evaluations'}
									{#if sortDirection === 'desc'}
										<SortDesc size={16} />
									{:else}
										<SortAsc size={16} />
									{/if}
								{/if}
							</button>
						</li>
					</ul>
				</details>
			</div>

			<div class="overflow-x-auto animate-fade-in">
				<Table
					columns={rankingColumns}
					rows={studentsWithRanking}
					striped={true}
					hover={true}
					bordered={true}
					emptyMessage="No hay estudiantes en este nivel y grupo."
				/>
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
