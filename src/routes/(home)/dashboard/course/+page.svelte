<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast.js';
	import { Settings, Activity, RefreshCw, ChartPie } from 'lucide-svelte';
	import type { Levels, CourseScore, EvalScore, EvalChartData } from '$lib/types';
	import type { CourseScoreDistribution } from '$lib/types/dashboard/course';
	import { CHART_COLORS, createScoreDistributionConfig } from '$lib/utils/chartUtils';

	// Props from server
	const { data } = $props<{
		data: {
			levels: Levels[];
			title: string;
		};
	}>();

	// State
	let selectedLevelCode = $state('');
	let selectedCourseCode = $state('');
	let selectedGroupName = $state('A'); // Default to group A
	let isLoadingCourses = $state(false);
	let isLoadingEvals = $state(false);
	let isLoadingDistribution = $state(false);
	let courseScores = $state<CourseScore[] | null>(null);
	let evalScores = $state<EvalScore[] | null>(null);
	let scoreDistribution = $state<CourseScoreDistribution | null>(null);
	let availableGroups = $state<string[]>(['A', 'B', 'C', 'D']);

	// Chart references
	let evalScoresChart: Chart | null = $state(null);
	let scoreDistributionByCourseChart: Chart | null = $state(null);

	// Use shared chart colors
	const chartColors = [
		CHART_COLORS.primary,
		CHART_COLORS.secondary,
		CHART_COLORS.tertiary,
		CHART_COLORS.quaternary
	];

	// Common chart options - consistent with other dashboards
	const baseChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			tooltip: {
				callbacks: {
					label: function (context: { dataset: { label?: string }; label?: string; raw: unknown }) {
						const label = context.dataset.label || context.label || '';
						const value = context.raw;
						return value !== null && typeof value === 'number'
							? `${label}: ${value.toFixed(2)}`
							: `${label}: Sin datos`;
					}
				}
			}
		}
	};

	// Derived values for chart data
	const evalChartData = $derived(prepareEvalChartData(evalScores));

	// Track chart data changes and render charts when data is available
	const shouldRenderEvalChart = $derived(
		evalScores !== null && !isLoadingEvals && selectedCourseCode !== ''
	);
	const shouldRenderDistributionChart = $derived(
		scoreDistribution !== null && !isLoadingDistribution && selectedCourseCode !== ''
	);

	// Render charts manually when data is loaded - safer than $effect
	async function updateChartsIfNeeded() {
		await tick(); // Wait for DOM updates
		if (shouldRenderEvalChart) {
			renderEvalChart();
		}
		if (shouldRenderDistributionChart) {
			renderScoreDistributionChart();
		}
	}

	// Clean up charts on unmount
	onMount(() => {
		return () => {
			destroyCharts();
		};
	});

	/**
	 * Destroys charts to prevent memory leaks
	 */
	function destroyCharts() {
		if (evalScoresChart) {
			evalScoresChart.destroy();
			evalScoresChart = null;
		}
		if (scoreDistributionByCourseChart) {
			scoreDistributionByCourseChart.destroy();
			scoreDistributionByCourseChart = null;
		}
	}

	/**
	 * Clears dependent data and charts - reduces code duplication
	 */
	function clearDependentData() {
		selectedCourseCode = '';
		courseScores = null;
		evalScores = null;
		scoreDistribution = null;
		destroyCharts();
	}

	/**
	 * Load course scores data from API
	 */
	async function loadCourseScoresData(levelCode: string, groupName: string) {
		if (!levelCode || !groupName || isLoadingCourses) return;

		isLoadingCourses = true;
		// Clear previous data immediately to prevent accumulation
		clearDependentData();

		try {
			// Build URL with required group filter
			const url = `/api/dashboard/course/scores/${levelCode}?group_name=${encodeURIComponent(groupName)}`;

			const response = await fetch(url);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage =
					errorData.error || `Error ${response.status}: No se pudieron cargar los datos de cursos`;
				throw new Error(errorMessage);
			}

			const data = await response.json();

			// Check if we have valid data
			if (!Array.isArray(data)) {
				throw new Error('Formato de datos inválido recibido del servidor');
			}

			// Set new data - this will only show courses for the selected group
			courseScores = data;
			// Trigger chart update after data is set
			updateChartsIfNeeded();
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
	 * Load evaluation scores data from API
	 */
	async function loadEvalScoresData(levelCode: string, courseCode: string, groupName: string) {
		if (!levelCode || !courseCode || !groupName || isLoadingEvals) return;

		isLoadingEvals = true;
		evalScores = null;

		if (evalScoresChart) {
			evalScoresChart.destroy();
			evalScoresChart = null;
		}

		try {
			const url = `/api/dashboard/course/evals/${levelCode}/${courseCode}?group_name=${encodeURIComponent(groupName)}`;
			const response = await fetch(url);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				const errorMessage =
					errorData.error ||
					`Error ${response.status}: No se pudieron cargar los datos de evaluaciones`;
				throw new Error(errorMessage);
			}

			const data = await response.json();

			// Check if we have valid data
			if (!Array.isArray(data)) {
				throw new Error('Formato de datos inválido recibido del servidor');
			}

			evalScores = data;
			// Trigger chart update after data is set
			updateChartsIfNeeded();
		} catch (error) {
			console.error('Error loading eval scores data:', error);
			showToast(
				error instanceof Error ? error.message : 'No se pudieron cargar los datos de evaluaciones',
				'danger'
			);
			evalScores = null;
		} finally {
			isLoadingEvals = false;
		}
	}

	/**
	 * Load score distribution data from API
	 */
	async function loadScoreDistributionData(
		levelCode: string,
		courseCode: string,
		groupName: string
	) {
		if (!levelCode || !courseCode || !groupName || isLoadingDistribution) return;

		isLoadingDistribution = true;
		scoreDistribution = null;

		if (scoreDistributionByCourseChart) {
			scoreDistributionByCourseChart.destroy();
			scoreDistributionByCourseChart = null;
		}

		try {
			const url = `/api/dashboard/course/distribution/${levelCode}/${courseCode}?group_name=${encodeURIComponent(groupName)}`;
			const response = await fetch(url);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Error al cargar distribución de puntajes');
			}

			const data = await response.json();

			// Check if we have valid data
			if (!data || typeof data !== 'object') {
				showToast('Formato de datos inválido', 'danger');
				scoreDistribution = null;
				return;
			}

			scoreDistribution = data;
			// Trigger chart update after data is set
			updateChartsIfNeeded();
		} catch (error) {
			console.error('Error loading score distribution data:', error);
			showToast(
				error instanceof Error ? error.message : 'No se pudieron cargar los datos de distribución',
				'danger'
			);
			scoreDistribution = null;
		} finally {
			isLoadingDistribution = false;
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
	 * Render evaluation scores chart
	 */
	function renderEvalChart() {
		if (!evalChartData.labels.length) return;

		setTimeout(() => {
			const ctx = document.getElementById('evalScoresChart') as HTMLCanvasElement;
			if (!ctx) return;

			// Destroy existing chart if it exists
			if (evalScoresChart) {
				evalScoresChart.destroy();
				evalScoresChart = null;
			}

			try {
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
								borderWidth: 3,
								fill: true,
								tension: 0.4,
								pointBackgroundColor: chartColors[0],
								pointBorderWidth: 2,
								pointRadius: 6,
								pointHoverRadius: 8
							}
						]
					},
					options: {
						...baseChartOptions,
						interaction: {
							intersect: false,
							mode: 'index'
						},
						plugins: {
							...baseChartOptions.plugins,
							legend: { display: false }
						},
						scales: {
							x: {
								title: {
									display: true,
									text: 'Evaluaciones',
									font: { weight: 'bold' }
								},
								grid: { display: false }
							},
							y: {
								beginAtZero: true,
								max: 20,
								title: {
									display: true,
									text: 'Puntaje Promedio',
									font: { weight: 'bold' }
								},
								grid: { color: 'rgba(0, 0, 0, 0.1)' }
							}
						}
					}
				});
			} catch (error) {
				console.error('Error rendering eval chart:', error);
			}
		}, 50);
	}

	/**
	 * Render score distribution chart
	 */
	function renderScoreDistributionChart() {
		if (!scoreDistribution || scoreDistribution.totalCount === 0) return;

		setTimeout(() => {
			const ctx = document.getElementById('scoreDistributionByCourseChart') as HTMLCanvasElement;
			if (!ctx || !scoreDistribution) return;

			// Destroy existing chart if it exists
			if (scoreDistributionByCourseChart) {
				scoreDistributionByCourseChart.destroy();
				scoreDistributionByCourseChart = null;
			}

			try {
				const config = createScoreDistributionConfig({
					approved: scoreDistribution.approved,
					middle: scoreDistribution.middle,
					failed: scoreDistribution.failed
				});

				scoreDistributionByCourseChart = new Chart(ctx, config);
			} catch (error) {
				console.error('Error rendering score distribution chart:', error);
			}
		}, 50);
	}

	/**
	 * Handle level selection change
	 */
	function handleLevelChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedLevelCode = target.value;

		// Clear dependent data
		clearDependentData();

		// Load new data if level is selected
		if (selectedLevelCode) {
			loadCourseScoresData(selectedLevelCode, selectedGroupName);
		}
	}

	/**
	 * Handle course selection change
	 */
	function handleCourseChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedCourseCode = target.value;

		// Clear eval and distribution data
		evalScores = null;
		scoreDistribution = null;
		if (evalScoresChart) {
			evalScoresChart.destroy();
			evalScoresChart = null;
		}
		if (scoreDistributionByCourseChart) {
			scoreDistributionByCourseChart.destroy();
			scoreDistributionByCourseChart = null;
		}

		// Load data only if course is selected
		if (selectedCourseCode) {
			loadEvalScoresData(selectedLevelCode, selectedCourseCode, selectedGroupName);
			loadScoreDistributionData(selectedLevelCode, selectedCourseCode, selectedGroupName);
		}
	}

	/**
	 * Handle group selection change
	 */
	function handleGroupChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedGroupName = target.value;

		// Clear dependent data
		clearDependentData();

		// Load new data if level is selected
		if (selectedLevelCode) {
			loadCourseScoresData(selectedLevelCode, selectedGroupName);
		}
	}

	/**
	 * Handle refresh button click - improved UX
	 */
	function handleRefresh() {
		if (selectedLevelCode) {
			loadCourseScoresData(selectedLevelCode, selectedGroupName);
		}
		if (selectedCourseCode) {
			loadEvalScoresData(selectedLevelCode, selectedCourseCode, selectedGroupName);
			loadScoreDistributionData(selectedLevelCode, selectedCourseCode, selectedGroupName);
		}
	}
</script>

<PageTitle title={data.title} description="Estadísticas y análisis de rendimiento por curso">
	{#if selectedLevelCode}
		<div>
			<button
				class="btn btn-primary btn-sm"
				onclick={handleRefresh}
				disabled={isLoadingCourses || isLoadingEvals}
			>
				{#if isLoadingCourses || isLoadingEvals}
					<span class="loading loading-spinner loading-xs mr-1"></span>
				{:else}
					<RefreshCw class="h-4 w-4 mr-1" />
				{/if}
				Actualizar
			</button>
		</div>
	{/if}
</PageTitle>

<main class="container mx-auto p-4">
	<!-- Selection Controls -->
	<div class="card bg-base-200 border border-base-300/30 rounded-xl mb-6 overflow-hidden">
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

	{#if isLoadingCourses && selectedLevelCode}
		<div
			class="flex justify-center items-center h-64 bg-base-200 rounded-xl border border-base-300/30 p-6"
		>
			<div class="loading loading-spinner loading-lg text-primary"></div>
			<span class="ml-4 text-base-content/70 text-lg">Cargando datos de cursos...</span>
		</div>
	{:else if !selectedLevelCode}
		<div
			class="card bg-gradient-to-br from-base-200 to-base-100 border border-base-300/30 rounded-xl overflow-hidden"
		>
			<div class="card-body p-8 text-center">
				<div
					class="w-20 h-20 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4"
				>
					<Activity class="w-10 h-10" />
				</div>
				<h2 class="text-2xl font-semibold">Dashboard de Cursos</h2>
				<p class="text-base-content/70 text-lg mt-2 max-w-md mx-auto">
					Visualiza el rendimiento por curso y evaluación
				</p>
				<div class="divider"></div>
				<p class="text-base-content/70 mt-2">
					Selecciona un nivel en el menú superior para comenzar a visualizar los datos
				</p>
			</div>
		</div>
	{:else}
		<!-- Dashboard Content -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
			<!-- Eval Scores Chart -->
			<div
				class="card bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-xl overflow-hidden"
			>
				<div class="card-body p-5">
					<div class="flex items-center gap-3 mb-3">
						<div
							class="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/15 text-secondary"
						>
							<Activity class="h-5 w-5" />
						</div>
						<h3 class="text-lg font-medium">
							{#if selectedCourseCode && courseScores}
								{#each courseScores as course (course.course_code)}
									{#if course.course_code === selectedCourseCode}
										Evolución: {course.course_name}
									{/if}
								{/each}
							{:else}
								Evolución de Puntajes
							{/if}
						</h3>
					</div>
					<div class="divider my-0"></div>
					{#if !selectedCourseCode}
						<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
							<div class="text-4xl mb-4">📈</div>
							<p class="text-lg font-medium">Selecciona un curso</p>
							<p class="text-sm mt-2">Para visualizar la evolución de puntajes</p>
						</div>
					{:else if isLoadingEvals}
						<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
							<div class="loading loading-spinner loading-lg text-secondary mb-4"></div>
							<p class="text-lg font-medium">Cargando evaluaciones...</p>
							<p class="text-sm mt-2">Obteniendo evolución de puntajes</p>
						</div>
					{:else if !evalScores || evalScores.length === 0}
						<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
							<div class="text-4xl mb-4">🔍</div>
							<p class="text-lg font-medium">No hay datos disponibles</p>
							<p class="text-sm mt-2">
								No se encontraron evaluaciones para este curso en el grupo {selectedGroupName}
							</p>
						</div>
					{:else}
						<div class="h-80 relative mt-2">
							<canvas id="evalScoresChart"></canvas>
						</div>
					{/if}
				</div>
			</div>

			<!-- Score Distribution Chart -->
			{#if selectedCourseCode}
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
							<h3 class="text-lg font-medium">
								{#if courseScores}
									{#each courseScores as course (course.course_code)}
										{#if course.course_code === selectedCourseCode}
											Distribución: {course.course_name}
										{/if}
									{/each}
								{:else}
									Distribución de Notas
								{/if}
							</h3>
						</div>
						<div class="divider my-0"></div>
						{#if isLoadingDistribution}
							<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
								<div class="loading loading-spinner loading-lg text-primary mb-4"></div>
								<p class="text-lg font-medium">Cargando distribución...</p>
								<p class="text-sm mt-2">Analizando puntajes del curso</p>
							</div>
						{:else if !scoreDistribution || scoreDistribution.totalCount === 0}
							<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
								<div class="text-4xl mb-4">📊</div>
								<p class="text-lg font-medium">No hay datos disponibles</p>
								<p class="text-sm mt-2">
									No se encontraron puntajes para este curso en el grupo {selectedGroupName}
								</p>
							</div>
						{:else}
							<div class="h-80 relative mt-2">
								<canvas id="scoreDistributionByCourseChart"></canvas>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</main>
