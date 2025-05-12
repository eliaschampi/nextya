<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast.js';
	import { Settings, ChartBar, ChartPie, Activity, Trophy } from 'lucide-svelte';
	import type { Level } from '$lib/types';
	import type { LevelDashboardData, GroupDashboardData } from '$lib/types/dashboard';

	// Props from server
	const { data } = $props<{
		data: {
			levels: Level[];
			title: string;
		};
	}>();

	// State
	let selectedLevelCode = $state('');
	let selectedGroupName = $state('');
	let isLoadingLevel = $state(false);
	let isLoadingGroup = $state(false);
	let levelData = $state<LevelDashboardData | null>(null);
	let groupData = $state<GroupDashboardData | null>(null);

	// Grupos disponibles (A, B, C, D)
	const availableGroups = ['A', 'B', 'C', 'D'];

	// Chart references
	let scoresByEvalChart: Chart | null = $state(null);
	let scoresByGroupChart: Chart | null = $state(null);
	let correctVsIncorrectChart: Chart | null = $state(null);
	let studentPerformanceChart: Chart | null = $state(null);

	// Colors for charts
	const chartColors = {
		primary: 'rgba(100, 220, 150, 0.8)',
		secondary: 'rgba(54, 162, 235, 0.8)',
		tertiary: 'rgba(255, 206, 86, 0.8)',
		quaternary: 'rgba(255, 99, 132, 0.8)',
		correct: 'rgba(75, 192, 192, 0.8)',
		incorrect: 'rgba(255, 99, 132, 0.8)',
		blank: 'rgba(201, 203, 207, 0.8)'
	};

	// Derived values for chart data
	const scoresByGroupData = $derived(levelData?.scoresByGroup || []);

	const correctVsIncorrectData = $derived(
		levelData?.correctVsIncorrect || { correct: 0, incorrect: 0, blank: 0 }
	);

	const scoresByEvalData = $derived(groupData?.scoresByEval || []);

	const studentPerformanceData = $derived(groupData?.studentPerformance || []);

	// Track chart data changes and render charts when data is available
	let shouldRenderLevelCharts = $derived(levelData !== null && !isLoadingLevel);
	let shouldRenderGroupCharts = $derived(groupData !== null && !isLoadingGroup);

	$effect(() => {
		if (shouldRenderLevelCharts) {
			// Ensure DOM is ready before rendering charts
			setTimeout(() => {
				destroyLevelCharts();
				renderLevelCharts();
			}, 100); // Small delay to ensure DOM is ready
		}
	});

	$effect(() => {
		if (shouldRenderGroupCharts) {
			// Ensure DOM is ready before rendering charts
			setTimeout(() => {
				destroyGroupCharts();
				renderGroupCharts();
			}, 100); // Small delay to ensure DOM is ready
		}
	});

	// Clean up charts on unmount
	onMount(() => {
		return () => {
			destroyCharts();
		};
	});

	/**
	 * Load level dashboard data from API
	 */
	async function loadLevelDashboardData(levelCode: string) {
		if (!levelCode || isLoadingLevel) return;

		isLoadingLevel = true;
		destroyLevelCharts();

		try {
			const response = await fetch(`/api/dashboard/level/${levelCode}`);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage = errorData.error || 'Error al cargar datos del dashboard';
				throw new Error(errorMessage);
			}

			const data = await response.json();

			// Check if we have valid data
			if (!data || typeof data !== 'object') {
				showToast('Formato de datos inválido', 'danger');
				levelData = null;
				return;
			}

			levelData = data;
		} catch (error) {
			console.error('Error loading level dashboard data:', error);
			showToast(
				error instanceof Error ? error.message : 'No se pudieron cargar los datos del dashboard',
				'danger'
			);
			levelData = null;
		} finally {
			isLoadingLevel = false;
		}
	}

	/**
	 * Load group dashboard data from API
	 */
	async function loadGroupDashboardData(levelCode: string, groupName: string) {
		if (!levelCode || !groupName || isLoadingGroup) return;

		isLoadingGroup = true;
		destroyGroupCharts();

		try {
			const response = await fetch(`/api/dashboard/group/${levelCode}/${groupName}`);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage = errorData.error || 'Error al cargar datos del dashboard';
				throw new Error(errorMessage);
			}

			const data = await response.json();

			// Check if we have valid data
			if (!data || typeof data !== 'object') {
				showToast('Formato de datos inválido', 'danger');
				groupData = null;
				return;
			}

			groupData = data;
		} catch (error) {
			console.error('Error loading group dashboard data:', error);
			showToast(
				error instanceof Error ? error.message : 'No se pudieron cargar los datos del dashboard',
				'danger'
			);
			groupData = null;
		} finally {
			isLoadingGroup = false;
		}
	}

	/**
	 * Render level charts (scoresByGroup and correctVsIncorrect)
	 */
	function renderLevelCharts() {
		// Use Promise.all to render charts in parallel
		Promise.all([renderScoresByGroupChart(), renderCorrectVsIncorrectChart()]).catch((error) => {
			console.error('Error rendering level charts:', error);
		});
	}

	/**
	 * Render group charts (scoresByEval and studentPerformance)
	 */
	function renderGroupCharts() {
		// Use Promise.all to render charts in parallel
		Promise.all([renderScoresByEvalChart(), renderStudentPerformanceChart()]).catch((error) => {
			console.error('Error rendering group charts:', error);
		});
	}

	/**
	 * Destroy level charts
	 */
	function destroyLevelCharts() {
		if (scoresByGroupChart) {
			scoresByGroupChart.destroy();
			scoresByGroupChart = null;
		}

		if (correctVsIncorrectChart) {
			correctVsIncorrectChart.destroy();
			correctVsIncorrectChart = null;
		}
	}

	/**
	 * Destroy group charts
	 */
	function destroyGroupCharts() {
		if (scoresByEvalChart) {
			scoresByEvalChart.destroy();
			scoresByEvalChart = null;
		}

		if (studentPerformanceChart) {
			studentPerformanceChart.destroy();
			studentPerformanceChart = null;
		}
	}

	/**
	 * Destroy all charts
	 */
	function destroyCharts() {
		destroyLevelCharts();
		destroyGroupCharts();
	}

	/**
	 * Render scores by evaluation chart
	 * Shows the evolution of scores over time
	 */
	function renderScoresByEvalChart() {
		if (!scoresByEvalData || scoresByEvalData.length === 0) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const ctx = document.getElementById('scoresByEvalChart') as HTMLCanvasElement;
			if (!ctx) {
				resolve();
				return;
			}

			try {
				const labels = scoresByEvalData.map((item) => item.name);
				const values = scoresByEvalData.map((item) => item.averageScore);

				scoresByEvalChart = new Chart(ctx, {
					type: 'line',
					data: {
						labels,
						datasets: [
							{
								label: 'Promedio de Puntaje',
								data: values,
								backgroundColor: chartColors.primary,
								borderColor: chartColors.primary,
								tension: 0.3,
								fill: false
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						scales: {
							y: {
								beginAtZero: true,
								max: 20
							}
						},
						plugins: {
							title: {
								display: true,
								text: 'Evolución de Puntajes por Evaluación'
							}
						}
					}
				});
				resolve();
			} catch (error) {
				console.error('Error rendering scores by eval chart:', error);
				reject(error);
			}
		});
	}

	/**
	 * Render scores by group chart
	 * Shows average scores by student group
	 */
	function renderScoresByGroupChart() {
		if (!scoresByGroupData || scoresByGroupData.length === 0) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const ctx = document.getElementById('scoresByGroupChart') as HTMLCanvasElement;
			if (!ctx) {
				resolve();
				return;
			}

			try {
				const labels = scoresByGroupData.map((item) => item.group);
				const values = scoresByGroupData.map((item) => item.averageScore);

				scoresByGroupChart = new Chart(ctx, {
					type: 'bar',
					data: {
						labels,
						datasets: [
							{
								label: 'Promedio de Puntaje',
								data: values,
								backgroundColor: chartColors.secondary,
								borderColor: chartColors.secondary,
								borderWidth: 1
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						scales: {
							y: {
								beginAtZero: true,
								max: 20
							}
						},
						plugins: {
							title: {
								display: true,
								text: 'Puntajes Promedio por Grupo'
							}
						}
					}
				});
				resolve();
			} catch (error) {
				console.error('Error rendering scores by group chart:', error);
				reject(error);
			}
		});
	}

	/**
	 * Render correct vs incorrect chart
	 * Shows distribution of correct, incorrect, and blank answers
	 */
	function renderCorrectVsIncorrectChart() {
		if (!correctVsIncorrectData) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const ctx = document.getElementById('correctVsIncorrectChart') as HTMLCanvasElement;
			if (!ctx) {
				resolve();
				return;
			}

			try {
				const values = [
					correctVsIncorrectData.correct,
					correctVsIncorrectData.incorrect,
					correctVsIncorrectData.blank
				];

				correctVsIncorrectChart = new Chart(ctx, {
					type: 'doughnut',
					data: {
						labels: ['Correctas', 'Incorrectas', 'En blanco'],
						datasets: [
							{
								data: values,
								backgroundColor: [chartColors.correct, chartColors.incorrect, chartColors.blank],
								borderWidth: 1
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							title: {
								display: true,
								text: 'Distribución de Respuestas'
							}
						}
					}
				});
				resolve();
			} catch (error) {
				console.error('Error rendering correct vs incorrect chart:', error);
				reject(error);
			}
		});
	}

	/**
	 * Render student performance chart
	 * Shows top 10 students by average score
	 */
	function renderStudentPerformanceChart() {
		if (!studentPerformanceData || studentPerformanceData.length === 0) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const ctx = document.getElementById('studentPerformanceChart') as HTMLCanvasElement;
			if (!ctx) {
				resolve();
				return;
			}

			try {
				const labels = studentPerformanceData.map((item) => item.name);
				const values = studentPerformanceData.map((item) => item.averageScore);

				studentPerformanceChart = new Chart(ctx, {
					type: 'bar',
					data: {
						labels,
						datasets: [
							{
								label: 'Promedio de Puntaje',
								data: values,
								backgroundColor: chartColors.tertiary,
								borderColor: chartColors.tertiary,
								borderWidth: 1
							}
						]
					},
					options: {
						indexAxis: 'y',
						responsive: true,
						maintainAspectRatio: false,
						scales: {
							x: {
								beginAtZero: true,
								max: 20
							}
						},
						plugins: {
							title: {
								display: true,
								text: 'Top 10 Estudiantes por Rendimiento'
							}
						}
					}
				});
				resolve();
			} catch (error) {
				console.error('Error rendering student performance chart:', error);
				reject(error);
			}
		});
	}
</script>

<PageTitle title={data.title} description="Estadísticas y análisis de rendimiento académico">
	{#if selectedLevelCode}
		<div>
			<button
				class="btn btn-primary btn-sm"
				onclick={() => {
					loadLevelDashboardData(selectedLevelCode);
					if (selectedGroupName) loadGroupDashboardData(selectedLevelCode, selectedGroupName);
				}}
				disabled={isLoadingLevel || isLoadingGroup}
			>
				{#if isLoadingLevel || isLoadingGroup}
					<span class="loading loading-spinner loading-xs mr-1"></span>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4 mr-1"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
						<path d="M3 3v5h5"></path>
						<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
						<path d="M16 21h5v-5"></path>
					</svg>
				{/if}
				Actualizar
			</button>
		</div>
	{/if}
</PageTitle>

<div class="card bg-base-200 shadow-lg border border-base-300/30 rounded-xl mb-6 overflow-hidden">
	<div class="card-body p-5">
		<div class="flex items-center gap-3 mb-2">
			<div class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
				<Settings class="h-5 w-5" />
			</div>
			<h3 class="text-lg font-medium">Configuración del Dashboard</h3>
		</div>
		<div class="divider my-1"></div>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<fieldset class="fieldset">
				<label for="level-select" class="fieldset-legend font-medium text-base-content/80">
					Selecciona un nivel académico
				</label>
				<div class="mt-2">
					<select
						id="level-select"
						class="select select-bordered w-full"
						bind:value={selectedLevelCode}
						onchange={() => {
							selectedGroupName = '';
							loadLevelDashboardData(selectedLevelCode);
						}}
					>
						<option value="" disabled selected>Selecciona un nivel</option>
						{#each data.levels as level (level.code)}
							<option value={level.code}>{level.name}</option>
						{/each}
					</select>
				</div>
			</fieldset>
			{#if selectedLevelCode}
				<fieldset class="fieldset">
					<label for="group-select" class="fieldset-legend font-medium text-base-content/80">
						Filtrar por grupo
					</label>
					<div class="mt-2">
						<select
							id="group-select"
							class="select select-bordered w-full"
							bind:value={selectedGroupName}
							onchange={() => {
								if (selectedGroupName) {
									loadGroupDashboardData(selectedLevelCode, selectedGroupName);
								}
							}}
						>
							<option value="" disabled selected>Seleccione un grupo</option>
							{#each availableGroups as group (group)}
								<option value={group}>{group}</option>
							{/each}
						</select>
					</div>
				</fieldset>
			{/if}
		</div>
	</div>
</div>

{#if isLoadingLevel && isLoadingGroup}
	<div
		class="flex justify-center items-center h-64 bg-base-200 rounded-xl shadow-lg border border-base-300/30 p-6"
	>
		<div class="loading loading-spinner loading-lg text-primary"></div>
		<span class="ml-4 text-base-content/70 text-lg">Cargando datos del dashboard...</span>
	</div>
{:else if !selectedLevelCode}
	<div
		class="card bg-gradient-to-br from-base-200 to-base-100 shadow-lg border border-base-300/30 rounded-xl overflow-hidden"
	>
		<div class="card-body p-8 text-center">
			<div
				class="w-20 h-20 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4"
			>
				<ChartBar class="w-10 h-10" />
			</div>
			<h2 class="text-2xl font-semibold">Dashboard de Rendimiento</h2>
			<p class="text-base-content/70 text-lg mt-2 max-w-md mx-auto">
				Visualiza el rendimiento de estudiantes, grupos y evaluaciones
			</p>
			<div class="divider"></div>
			<p class="text-base-content/70 mt-2">
				Selecciona un nivel en el menú superior para comenzar a visualizar los datos
			</p>
		</div>
	</div>
{:else}
	<!-- Level Data Section -->
	{#if levelData}
		<h2 class="text-xl font-semibold mb-4">Datos por Nivel</h2>
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<!-- Scores by Group Chart -->
			{#if levelData.scoresByGroup && levelData.scoresByGroup.length > 0}
				<div
					class="card bg-gradient-to-br from-secondary/10 to-secondary/5 shadow-lg border border-secondary/20 rounded-xl overflow-hidden"
				>
					<div class="card-body p-5">
						<div class="flex items-center gap-3 mb-3">
							<div
								class="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/15 text-secondary"
							>
								<ChartBar class="h-5 w-5" />
							</div>
							<h3 class="text-lg font-medium">Puntajes por Grupo</h3>
						</div>
						<div class="divider my-0"></div>
						<div class="h-64 relative mt-2">
							<canvas id="scoresByGroupChart"></canvas>
						</div>
					</div>
				</div>
			{/if}

			<!-- Correct vs Incorrect Chart -->
			{#if levelData.correctVsIncorrect}
				<div
					class="card bg-gradient-to-br from-accent/10 to-accent/5 shadow-lg border border-accent/20 rounded-xl overflow-hidden"
				>
					<div class="card-body p-5">
						<div class="flex items-center gap-3 mb-3">
							<div
								class="w-8 h-8 flex items-center justify-center rounded-lg bg-accent/15 text-accent"
							>
								<ChartPie class="h-5 w-5" />
							</div>
							<h3 class="text-lg font-medium">Distribución de Respuestas</h3>
						</div>
						<div class="divider my-0"></div>
						<div class="h-64 relative mt-2">
							<canvas id="correctVsIncorrectChart"></canvas>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{:else if isLoadingLevel}
		<div class="mb-8">
			<div class="flex justify-center items-center h-32 bg-base-200 rounded-xl p-4">
				<div class="loading loading-spinner loading-md text-primary"></div>
				<span class="ml-4 text-base-content/70">Cargando datos del nivel...</span>
			</div>
		</div>
	{/if}

	<!-- Group Data Section -->
	{#if selectedGroupName}
		<h2 class="text-xl font-semibold mb-4">Datos del Grupo {selectedGroupName}</h2>
		{#if groupData}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Scores by Evaluation Chart -->
				{#if groupData.scoresByEval && groupData.scoresByEval.length > 0}
					<div
						class="card bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg border border-primary/20 rounded-xl overflow-hidden"
					>
						<div class="card-body p-5">
							<div class="flex items-center gap-3 mb-3">
								<div
									class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/15 text-primary"
								>
									<Activity class="h-5 w-5" />
								</div>
								<h3 class="text-lg font-medium">Evolución de Puntajes</h3>
							</div>
							<div class="divider my-0"></div>
							<div class="h-64 relative mt-2">
								<canvas id="scoresByEvalChart"></canvas>
							</div>
						</div>
					</div>
				{/if}

				<!-- Student Performance Chart -->
				{#if groupData.studentPerformance && groupData.studentPerformance.length > 0}
					<div
						class="card bg-gradient-to-br from-warning/10 to-warning/5 shadow-lg border border-warning/20 rounded-xl overflow-hidden"
					>
						<div class="card-body p-5">
							<div class="flex items-center gap-3 mb-3">
								<div
									class="w-8 h-8 flex items-center justify-center rounded-lg bg-warning/15 text-warning"
								>
									<Trophy class="h-5 w-5" />
								</div>
								<h3 class="text-lg font-medium">Top 10 Estudiantes</h3>
							</div>
							<div class="divider my-0"></div>
							<div class="h-64 relative mt-2">
								<canvas id="studentPerformanceChart"></canvas>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{:else if isLoadingGroup}
			<div class="flex justify-center items-center h-32 bg-base-200 rounded-xl p-4">
				<div class="loading loading-spinner loading-md text-primary"></div>
				<span class="ml-4 text-base-content/70">Cargando datos del grupo...</span>
			</div>
		{:else}
			<div class="card bg-base-200 p-4 rounded-xl">
				<p class="text-center text-base-content/70">
					No hay datos disponibles para el grupo seleccionado
				</p>
			</div>
		{/if}
	{:else}
		<div class="card bg-base-200 p-4 rounded-xl">
			<p class="text-center text-base-content/70">Selecciona un grupo para ver datos específicos</p>
		</div>
	{/if}
{/if}
