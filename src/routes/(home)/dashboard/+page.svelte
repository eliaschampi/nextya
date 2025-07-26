<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast.js';
	import { Settings, ChartBar, ChartPie, Activity } from 'lucide-svelte';
	import type { Levels, CourseScore, CourseChartData } from '$lib/types';
	import type { LevelDashboardData, GroupDashboardData } from '$lib/types/dashboard';
	import { CHART_COLORS } from '$lib/utils/chartUtils';

	// Props from server
	const { data } = $props<{
		data: {
			levels: Levels[];
			title: string;
		};
	}>();

	// State
	let selectedLevelCode = $state('');
	let selectedGroupName = $state('');
	let isLoadingLevel = $state(false);
	let isLoadingGroup = $state(false);
	let isLoadingCourses = $state(false);
	let levelData = $state<LevelDashboardData | null>(null);
	let groupData = $state<GroupDashboardData | null>(null);
	let courseScores = $state<CourseScore[] | null>(null);

	// Grupos disponibles (A, B, C, D)
	const availableGroups = ['A', 'B', 'C', 'D'];

	// Chart references
	let scoresByEvalChart: Chart | null = $state(null);
	let scoresByGroupChart: Chart | null = $state(null);
	let courseScoresChart: Chart | null = $state(null);

	// Use shared chart colors
	const chartColors = {
		primary: CHART_COLORS.primary,
		secondary: CHART_COLORS.secondary,
		tertiary: CHART_COLORS.tertiary,
		quaternary: CHART_COLORS.quaternary
	};

	// Derived values for chart data
	const scoresByGroupData = $derived(levelData?.scoresByGroup || []);
	const courseChartData = $derived(prepareCourseChartData(courseScores));

	const scoresByEvalData = $derived(groupData?.scoresByEval || []);

	// Track chart data changes and render charts when data is available
	let shouldRenderLevelCharts = $derived(levelData !== null && !isLoadingLevel);
	let shouldRenderGroupCharts = $derived(groupData !== null && !isLoadingGroup);
	let shouldRenderCourseChart = $derived(courseScores !== null && !isLoadingCourses);

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

	$effect(() => {
		if (shouldRenderCourseChart) {
			// Ensure DOM is ready before rendering charts
			setTimeout(() => {
				renderCourseChart();
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
	 * Load course scores data from API
	 */
	async function loadCourseScoresData(levelCode: string, groupName: string) {
		if (!levelCode || !groupName || isLoadingCourses) return;

		isLoadingCourses = true;
		courseScores = null;

		if (courseScoresChart) {
			courseScoresChart.destroy();
			courseScoresChart = null;
		}

		try {
			const response = await fetch(
				`/api/dashboard/course/scores/${levelCode}?group_name=${groupName}`
			);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Error al cargar datos de cursos');
			}

			const data = await response.json();

			// Check if we have valid data
			if (!data || !Array.isArray(data)) {
				showToast('Formato de datos inválido', 'danger');
				courseScores = null;
				return;
			}

			// Set new data
			courseScores = data;
		} catch (error) {
			console.error('Error loading course scores data:', error);
			showToast(
				error instanceof Error ? error.message : 'No se pudieron cargar los datos de cursos',
				'danger'
			);
			courseScores = null;
		} finally {
			isLoadingCourses = false;
		}
	}

	/**
	 * Prepare data for course scores chart
	 */
	function prepareCourseChartData(data: CourseScore[] | null): CourseChartData {
		if (!data || !Array.isArray(data) || !data.length) {
			return { labels: [], values: [] };
		}

		try {
			return {
				labels: data.map((item) => item.course_name || 'Sin nombre'),
				values: data.map((item) => item.average_score || 0)
			};
		} catch (error) {
			console.error('Error processing course scores data:', error);
			return { labels: [], values: [] };
		}
	}

	/**
	 * Render level charts (scoresByGroup only)
	 */
	function renderLevelCharts() {
		// Render scores by group chart
		renderScoresByGroupChart().catch((error) => {
			console.error('Error rendering level charts:', error);
		});
	}

	/**
	 * Render group charts (scoresByEval only)
	 */
	function renderGroupCharts() {
		// Only render scores by eval chart
		renderScoresByEvalChart().catch((error) => {
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
	}

	/**
	 * Destroy group charts
	 */
	function destroyGroupCharts() {
		if (scoresByEvalChart) {
			scoresByEvalChart.destroy();
			scoresByEvalChart = null;
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
	 * Render course scores chart
	 */
	function renderCourseChart() {
		if (!courseChartData.labels.length) return;

		setTimeout(() => {
			const ctx = document.getElementById('courseScoresChart') as HTMLCanvasElement;
			if (!ctx) return;

			// Destroy existing chart if it exists
			if (courseScoresChart) {
				courseScoresChart.destroy();
				courseScoresChart = null;
			}

			try {
				// Generate colors for each course
				const colors = [
					chartColors.primary,
					chartColors.secondary,
					chartColors.tertiary,
					chartColors.quaternary
				];
				const backgroundColors = courseChartData.labels.map(
					(_, index) => colors[index % colors.length]
				);

				courseScoresChart = new Chart(ctx, {
					type: 'doughnut',
					data: {
						labels: courseChartData.labels,
						datasets: [
							{
								label: 'Promedio de Puntajes',
								data: courseChartData.values,
								backgroundColor: backgroundColors,
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
								text: 'Puntajes por Curso'
							},
							legend: {
								position: 'right',
								labels: {
									font: {
										size: 12
									}
								}
							}
						}
					}
				});
			} catch (error) {
				console.error('Error rendering course chart:', error);
			}
		}, 50);
	}
</script>

<PageTitle title={data.title} description="Estadísticas y análisis de rendimiento académico">
	{#if selectedLevelCode}
		<div>
			<button
				class="btn btn-primary btn-sm"
				onclick={() => {
					loadLevelDashboardData(selectedLevelCode);
					if (selectedGroupName) {
						loadGroupDashboardData(selectedLevelCode, selectedGroupName);
						loadCourseScoresData(selectedLevelCode, selectedGroupName);
					}
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

<div class="card bg-base-200 border border-base-300/30 rounded-xl mb-6 overflow-hidden">
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
									loadCourseScoresData(selectedLevelCode, selectedGroupName);
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
		class="flex justify-center items-center h-64 bg-base-200 rounded-xl border border-base-300/30 p-6"
	>
		<div class="loading loading-spinner loading-lg text-primary"></div>
		<span class="ml-4 text-base-content/70 text-lg">Cargando datos del dashboard...</span>
	</div>
{:else if !selectedLevelCode}
	<div
		class="card bg-gradient-to-br from-base-200 to-base-100 border border-base-300/30 rounded-xl overflow-hidden"
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
					class="card bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-xl overflow-hidden"
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
						<div class="h-80 relative mt-2">
							<canvas id="scoresByGroupChart"></canvas>
						</div>
					</div>
				</div>
			{/if}

			<!-- Course Scores Chart -->
			{#if selectedGroupName && courseScores && courseScores.length > 0}
				<div
					class="card bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl overflow-hidden"
				>
					<div class="card-body p-5">
						<div class="flex items-center gap-3 mb-3">
							<div
								class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/15 text-primary"
							>
								<ChartPie class="h-5 w-5" />
							</div>
							<h3 class="text-lg font-medium">Puntajes por Curso - Grupo {selectedGroupName}</h3>
						</div>
						<div class="divider my-0"></div>
						{#if isLoadingCourses}
							<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
								<div class="loading loading-spinner loading-lg text-primary mb-4"></div>
								<p class="text-lg font-medium">Cargando cursos...</p>
								<p class="text-sm mt-2">Obteniendo datos para el grupo {selectedGroupName}</p>
							</div>
						{:else}
							<div class="h-80 relative mt-2">
								<canvas id="courseScoresChart"></canvas>
							</div>
						{/if}
					</div>
				</div>
			{:else if selectedGroupName && isLoadingCourses}
				<div
					class="card bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl overflow-hidden"
				>
					<div class="card-body p-5">
						<div class="flex items-center gap-3 mb-3">
							<div
								class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/15 text-primary"
							>
								<ChartPie class="h-5 w-5" />
							</div>
							<h3 class="text-lg font-medium">Puntajes por Curso - Grupo {selectedGroupName}</h3>
						</div>
						<div class="divider my-0"></div>
						<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
							<div class="loading loading-spinner loading-lg text-primary mb-4"></div>
							<p class="text-lg font-medium">Cargando cursos...</p>
							<p class="text-sm mt-2">Obteniendo datos para el grupo {selectedGroupName}</p>
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
			<!-- Scores by Evaluation Chart - Full Width -->
			{#if groupData.scoresByEval && groupData.scoresByEval.length > 0}
				<div
					class="card bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl overflow-hidden mb-6"
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
						<div class="h-80 relative mt-2">
							<canvas id="scoresByEvalChart"></canvas>
						</div>
					</div>
				</div>
			{/if}
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
