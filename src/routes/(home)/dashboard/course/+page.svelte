<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast.js';
	import { Settings, ChartPie, Activity } from 'lucide-svelte';
	import type { Level, CourseScore, EvalScore, CourseChartData, EvalChartData } from '$lib/types';

	// Props from server
	const { data } = $props<{
		data: {
			levels: Level[];
			title: string;
		};
	}>();

	// State
	let selectedLevelCode = $state('');
	let selectedCourseCode = $state('');
	let selectedGroupName = $state('A'); // Default to group A
	let isLoading = $state(false);
	let courseScores = $state<CourseScore[] | null>(null);
	let evalScores = $state<EvalScore[] | null>(null);
	let availableGroups = $state<string[]>(['A', 'B', 'C', 'D']);

	// Chart references
	let courseScoresChart: Chart | null = $state(null);
	let evalScoresChart: Chart | null = $state(null);

	// Colors for charts
	const chartColors = [
		'rgba(100, 220, 150, 0.8)',
		'rgba(54, 162, 235, 0.8)',
		'rgba(255, 206, 86, 0.8)',
		'rgba(255, 99, 132, 0.8)',
		'rgba(153, 102, 255, 0.8)',
		'rgba(255, 159, 64, 0.8)',
		'rgba(75, 192, 192, 0.8)',
		'rgba(201, 203, 207, 0.8)'
	];

	// Derived values for chart data
	const courseChartData = $derived(prepareCourseChartData(courseScores));
	const evalChartData = $derived(prepareEvalChartData(evalScores));

	// Track chart data changes and render charts when data is available
	const shouldRenderCourseChart = $derived(courseScores !== null && !isLoading);
	const shouldRenderEvalChart = $derived(evalScores !== null && !isLoading);

	// Render charts when data changes
	$effect(() => {
		if (shouldRenderCourseChart) {
			renderCourseChart();
		}
	});

	$effect(() => {
		if (shouldRenderEvalChart) {
			renderEvalChart();
		}
	});

	// Clean up charts on unmount
	onMount(() => {
		return () => {
			destroyCharts();
		};
	});

	/**
	 * Destroys both charts to prevent memory leaks
	 */
	function destroyCharts() {
		if (courseScoresChart) {
			courseScoresChart.destroy();
			courseScoresChart = null;
		}
		if (evalScoresChart) {
			evalScoresChart.destroy();
			evalScoresChart = null;
		}
	}

	/**
	 * Load course scores data from API
	 */
	async function loadCourseScoresData(levelCode: string, groupName: string) {
		if (!levelCode || !groupName || isLoading) return;

		isLoading = true;
		if (courseScoresChart) courseScoresChart.destroy();

		try {
			// Build URL with required group filter
			const url = `/api/dashboard/course/scores/${levelCode}?group_name=${encodeURIComponent(groupName)}`;

			const response = await fetch(url);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage = errorData.error || 'Error al cargar datos de cursos';
				throw new Error(errorMessage);
			}

			const data = await response.json();

			// Check if we have valid data
			if (!data || !Array.isArray(data)) {
				showToast('Formato de datos inválido', 'danger');
				courseScores = null;
				return;
			}

			courseScores = data;

			// Reset selected course if it's not in the new data
			if (selectedCourseCode && !data.some((course) => course.course_code === selectedCourseCode)) {
				selectedCourseCode = '';
				evalScores = null;
			}
		} catch (error) {
			console.error('Error loading course scores data:', error);
			showToast(
				error instanceof Error ? error.message : 'No se pudieron cargar los datos de cursos',
				'danger'
			);
			courseScores = null;
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Load evaluation scores data from API
	 */
	async function loadEvalScoresData(levelCode: string, courseCode: string) {
		if (!levelCode || !courseCode || isLoading) return;

		isLoading = true;
		if (evalScoresChart) evalScoresChart.destroy();

		try {
			const response = await fetch(`/api/dashboard/course/evals/${levelCode}/${courseCode}`);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage = errorData.error || 'Error al cargar datos de evaluaciones';
				throw new Error(errorMessage);
			}

			const data = await response.json();

			// Check if we have valid data
			if (!data || !Array.isArray(data)) {
				showToast('Formato de datos inválido', 'danger');
				evalScores = null;
				return;
			}

			evalScores = data;
		} catch (error) {
			console.error('Error loading eval scores data:', error);
			showToast(
				error instanceof Error ? error.message : 'No se pudieron cargar los datos de evaluaciones',
				'danger'
			);
			evalScores = null;
		} finally {
			isLoading = false;
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
	 * Prepare data for evaluation scores chart
	 */
	function prepareEvalChartData(data: EvalScore[] | null): EvalChartData {
		if (!data || !Array.isArray(data) || !data.length) {
			return { labels: [], values: [] };
		}

		try {
			return {
				labels: data.map((item) => item.eval_name || 'Sin nombre'),
				values: data.map((item) => item.average_score || 0)
			};
		} catch (error) {
			console.error('Error processing eval scores data:', error);
			return { labels: [], values: [] };
		}
	}

	/**
	 * Render course scores chart
	 */
	function renderCourseChart() {
		if (!courseChartData.labels.length) return;

		// Ensure DOM is ready before rendering
		setTimeout(() => {
			const ctx = document.getElementById('courseScoresChart') as HTMLCanvasElement;
			if (!ctx) return;

			// Destroy existing chart if it exists
			if (courseScoresChart) courseScoresChart.destroy();

			courseScoresChart = new Chart(ctx, {
				type: 'doughnut',
				data: {
					labels: courseChartData.labels,
					datasets: [
						{
							label: 'Promedio de Puntajes',
							data: courseChartData.values,
							backgroundColor: chartColors.slice(0, courseChartData.labels.length),
							borderWidth: 1
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: 'right',
							labels: {
								font: {
									size: 12
								}
							}
						},
						tooltip: {
							callbacks: {
								label: function (context) {
									const label = context.label || '';
									const value = context.raw as number;
									return `${label}: ${value.toFixed(2)}`;
								}
							}
						}
					}
				}
			});
		}, 50);
	}

	/**
	 * Render evaluation scores chart
	 */
	function renderEvalChart() {
		if (!evalChartData.labels.length) return;

		// Ensure DOM is ready before rendering
		setTimeout(() => {
			const ctx = document.getElementById('evalScoresChart') as HTMLCanvasElement;
			if (!ctx) return;

			// Destroy existing chart if it exists
			if (evalScoresChart) evalScoresChart.destroy();

			evalScoresChart = new Chart(ctx, {
				type: 'line',
				data: {
					labels: evalChartData.labels,
					datasets: [
						{
							label: 'Promedio de Puntajes',
							data: evalChartData.values,
							borderColor: chartColors[0],
							backgroundColor: 'rgba(100, 220, 150, 0.1)',
							borderWidth: 2,
							fill: true,
							tension: 0.4
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: false
						},
						tooltip: {
							callbacks: {
								label: function (context) {
									const label = context.dataset.label || '';
									const value = context.raw as number;
									return `${label}: ${value.toFixed(2)}`;
								}
							}
						}
					},
					scales: {
						x: {
							title: {
								display: true,
								text: 'Evaluaciones'
							}
						},
						y: {
							beginAtZero: true,
							max: 100,
							title: {
								display: true,
								text: 'Puntaje Promedio'
							}
						}
					}
				}
			});
		}, 50);
	}

	/**
	 * Handle level selection change
	 */
	function handleLevelChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedLevelCode = target.value;
		selectedCourseCode = '';
		evalScores = null;

		if (evalScoresChart) {
			evalScoresChart.destroy();
			evalScoresChart = null;
		}

		loadCourseScoresData(selectedLevelCode, selectedGroupName);
	}

	/**
	 * Handle course selection change
	 */
	function handleCourseChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedCourseCode = target.value;
		loadEvalScoresData(selectedLevelCode, selectedCourseCode);
	}

	/**
	 * Handle group selection change
	 */
	function handleGroupChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedGroupName = target.value;
		selectedCourseCode = '';
		evalScores = null;

		if (evalScoresChart) {
			evalScoresChart.destroy();
			evalScoresChart = null;
		}

		loadCourseScoresData(selectedLevelCode, selectedGroupName);
	}
</script>

<PageTitle title={data.title} description="Estadísticas y análisis de rendimiento por curso">
	<div></div>
</PageTitle>

<div class="container mx-auto px-0 py-6">
	<!-- Selection Controls -->
	<div class="card bg-base-200 shadow-lg border border-base-300/30 rounded-xl mb-6 overflow-hidden">
		<div class="card-body p-5">
			<div class="flex items-center gap-3 mb-2">
				<div class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
					<Settings class="h-5 w-5" />
				</div>
				<h3 class="text-lg font-medium">Configuración del Dashboard</h3>
			</div>
			<div class="divider my-1"></div>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<fieldset class="fieldset">
					<label for="levelSelect" class="fieldset-legend font-medium text-base-content/80"
						>Nivel</label
					>
					<div class="mt-2">
						<select
							id="levelSelect"
							class="select select-bordered w-full"
							onchange={handleLevelChange}
							value={selectedLevelCode}
						>
							<option value="" disabled>Seleccionar nivel</option>
							{#each data.levels as level (level.code)}
								<option value={level.code}>{level.name}</option>
							{/each}
						</select>
					</div>
				</fieldset>

				<fieldset class="fieldset">
					<label for="groupSelect" class="fieldset-legend font-medium text-base-content/80"
						>Grupo</label
					>
					<div class="mt-2">
						<select
							id="groupSelect"
							class="select select-bordered w-full"
							onchange={handleGroupChange}
							value={selectedGroupName}
							disabled={!selectedLevelCode}
						>
							{#each availableGroups as group (group)}
								<option value={group}>{group}</option>
							{/each}
						</select>
					</div>
				</fieldset>

				<fieldset class="fieldset">
					<label for="courseSelect" class="fieldset-legend font-medium text-base-content/80"
						>Curso</label
					>
					<div class="mt-2">
						<select
							id="courseSelect"
							class="select select-bordered w-full"
							onchange={handleCourseChange}
							value={selectedCourseCode}
							disabled={!courseScores || courseScores.length === 0}
						>
							<option value="" disabled>Seleccionar curso</option>
							{#if courseScores && courseScores.length > 0}
								{#each courseScores as course (course.course_code)}
									<option value={course.course_code}>{course.course_name}</option>
								{/each}
							{/if}
						</select>
					</div>
				</fieldset>
			</div>
		</div>
	</div>

	<!-- Charts Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<!-- Course Scores Chart -->
		<div
			class="card bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg border border-primary/20 rounded-xl overflow-hidden"
		>
			<div class="card-body p-5">
				<div class="flex items-center gap-3 mb-3">
					<div
						class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/15 text-primary"
					>
						<ChartPie class="h-5 w-5" />
					</div>
					<h3 class="text-lg font-medium">Promedio de Puntajes por Curso</h3>
				</div>
				<div class="divider my-0"></div>

				{#if isLoading}
					<div class="flex justify-center items-center h-64">
						<div class="loading loading-spinner loading-lg text-primary"></div>
					</div>
				{:else if !selectedLevelCode}
					<div class="flex flex-col justify-center items-center h-64 text-base-content/70">
						<div class="text-4xl mb-4">📊</div>
						<p class="text-lg font-medium">Selecciona un nivel</p>
						<p class="text-sm mt-2">Para visualizar los datos de puntajes por curso</p>
					</div>
				{:else if !courseScores || courseScores.length === 0}
					<div class="flex flex-col justify-center items-center h-64 text-base-content/70">
						<div class="text-4xl mb-4">🔍</div>
						<p class="text-lg font-medium">No hay datos disponibles</p>
						<p class="text-sm mt-2">No se encontraron cursos para este nivel</p>
					</div>
				{:else}
					<div class="h-64 relative mt-2">
						<canvas id="courseScoresChart"></canvas>
					</div>
				{/if}
			</div>
		</div>

		<!-- Eval Scores Chart -->
		<div
			class="card bg-gradient-to-br from-secondary/10 to-secondary/5 shadow-lg border border-secondary/20 rounded-xl overflow-hidden"
		>
			<div class="card-body p-5">
				<div class="flex items-center gap-3 mb-3">
					<div
						class="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/15 text-secondary"
					>
						<Activity class="h-5 w-5" />
					</div>
					<h3 class="text-lg font-medium">Evolución de Puntajes por Evaluación</h3>
				</div>
				<div class="divider my-0"></div>

				{#if isLoading}
					<div class="flex justify-center items-center h-64">
						<div class="loading loading-spinner loading-lg text-secondary"></div>
					</div>
				{:else if !selectedCourseCode}
					<div class="flex flex-col justify-center items-center h-64 text-base-content/70">
						<div class="text-4xl mb-4">📈</div>
						<p class="text-lg font-medium">Selecciona un curso</p>
						<p class="text-sm mt-2">Para visualizar la evolución de puntajes</p>
					</div>
				{:else if !evalScores || evalScores.length === 0}
					<div class="flex flex-col justify-center items-center h-64 text-base-content/70">
						<div class="text-4xl mb-4">🔍</div>
						<p class="text-lg font-medium">No hay datos disponibles</p>
						<p class="text-sm mt-2">No se encontraron evaluaciones para este curso</p>
					</div>
				{:else}
					<div class="h-64 relative mt-2">
						<canvas id="evalScoresChart"></canvas>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
