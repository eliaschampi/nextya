<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast.js';
	import type { Level } from '$lib/types';
	import type { DashboardData } from '$lib/types/dashboard';

	// Props from server
	const { data } = $props<{
		data: {
			levels: Level[];
			title: string;
		};
	}>();

	// State
	let selectedLevelCode = $state('');
	let isLoading = $state(false);
	let chartData = $state<DashboardData | null>(null);

	// Chart references
	let scoresByEvalChart: Chart | null = $state(null);
	let scoresByGroupChart: Chart | null = $state(null);
	let scoresByCourseChart: Chart | null = $state(null);
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
	const scoresByEvalData = $derived(getScoresByEvalData(chartData));
	const scoresByGroupData = $derived(getScoresByGroupData(chartData));
	const scoresByCourseData = $derived(getScoresByCourseData(chartData));
	const correctVsIncorrectData = $derived(getCorrectVsIncorrectData(chartData));
	const studentPerformanceData = $derived(getStudentPerformanceData(chartData));

	// Track chart data changes and render charts when data is available
	let shouldRenderCharts = $derived(chartData !== null && !isLoading);

	$effect(() => {
		if (shouldRenderCharts) {
			// Ensure DOM is ready before rendering charts
			setTimeout(() => {
				destroyCharts();
				renderCharts();
			}, 100); // Small delay to ensure DOM is ready
		}
	});

	// Clean up charts on unmount
	onMount(() => {
		return () => {
			destroyCharts();
		};
	});

	// Load dashboard data from API
	async function loadDashboardData(levelCode: string) {
		if (isLoading) return;

		isLoading = true;
		destroyCharts();

		try {
			const response = await fetch(`/api/dashboard/${levelCode}`);

			if (!response.ok) {
				throw new Error('Error al cargar datos del dashboard');
			}

			const data = await response.json();

			// Check if we have valid data
			if (!data || typeof data !== 'object') {
				showToast('Formato de datos inválido', 'danger');
				chartData = null;
				return;
			}

			chartData = data;
		} catch (error) {
			console.error('Error loading dashboard data:', error);
			showToast('No se pudieron cargar los datos del dashboard', 'danger');
			chartData = null;
		} finally {
			isLoading = false;
		}
	}

	// Helper functions to prepare chart data
	function getScoresByEvalData(data: DashboardData | null): { labels: string[]; values: number[] } {
		if (
			!data ||
			!data.scoresByEval ||
			!Array.isArray(data.scoresByEval) ||
			!data.scoresByEval.length
		) {
			return { labels: [], values: [] };
		}

		try {
			return {
				labels: data.scoresByEval.map((item) => item.name || 'Sin nombre'),
				values: data.scoresByEval.map((item) => item.averageScore || 0)
			};
		} catch (error) {
			console.error('Error processing scoresByEval data:', error);
			return { labels: [], values: [] };
		}
	}

	function getScoresByGroupData(data: DashboardData | null): {
		labels: string[];
		values: number[];
	} {
		if (
			!data ||
			!data.scoresByGroup ||
			!Array.isArray(data.scoresByGroup) ||
			!data.scoresByGroup.length
		) {
			return { labels: [], values: [] };
		}

		try {
			return {
				labels: data.scoresByGroup.map((item) => item.group || 'Sin grupo'),
				values: data.scoresByGroup.map((item) => item.averageScore || 0)
			};
		} catch (error) {
			console.error('Error processing scoresByGroup data:', error);
			return { labels: [], values: [] };
		}
	}

	function getCorrectVsIncorrectData(data: DashboardData | null): { values: number[] } {
		if (!data || !data.correctVsIncorrect) {
			return { values: [] };
		}

		try {
			const { correct = 0, incorrect = 0, blank = 0 } = data.correctVsIncorrect;
			return { values: [correct, incorrect, blank] };
		} catch (error) {
			console.error('Error processing correctVsIncorrect data:', error);
			return { values: [] };
		}
	}

	function getStudentPerformanceData(data: DashboardData | null): {
		labels: string[];
		values: number[];
	} {
		if (
			!data ||
			!data.studentPerformance ||
			!Array.isArray(data.studentPerformance) ||
			!data.studentPerformance.length
		) {
			return { labels: [], values: [] };
		}

		try {
			return {
				labels: data.studentPerformance.map((item) => item.name || 'Sin nombre'),
				values: data.studentPerformance.map((item) => item.averageScore || 0)
			};
		} catch (error) {
			console.error('Error processing studentPerformance data:', error);
			return { labels: [], values: [] };
		}
	}

	function getScoresByCourseData(data: DashboardData | null): {
		labels: string[];
		values: number[];
	} {
		if (
			!data ||
			!data.scoresByCourse ||
			!Array.isArray(data.scoresByCourse) ||
			!data.scoresByCourse.length
		) {
			return { labels: [], values: [] };
		}

		try {
			return {
				labels: data.scoresByCourse.map((item) => item.name || 'Sin nombre'),
				values: data.scoresByCourse.map((item) => item.averageScore || 0)
			};
		} catch (error) {
			console.error('Error processing scoresByCourse data:', error);
			return { labels: [], values: [] };
		}
	}

	// Render all charts
	function renderCharts() {
		renderScoresByEvalChart();
		renderScoresByGroupChart();
		renderScoresByCourseChart();
		renderCorrectVsIncorrectChart();
		renderStudentPerformanceChart();
	}

	// Render scores by evaluation chart
	function renderScoresByEvalChart() {
		if (!scoresByEvalData.labels.length) {
			return;
		}

		const ctx = document.getElementById('scoresByEvalChart') as HTMLCanvasElement;
		if (!ctx) {
			return;
		}

		try {
			scoresByEvalChart = new Chart(ctx, {
				type: 'line',
				data: {
					labels: scoresByEvalData.labels,
					datasets: [
						{
							label: 'Promedio de Puntaje',
							data: scoresByEvalData.values,
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
		} catch (error) {
			console.error('Error rendering scores by eval chart:', error);
		}
	}

	// Render scores by group chart
	function renderScoresByGroupChart() {
		if (!scoresByGroupData.labels.length) return;

		const ctx = document.getElementById('scoresByGroupChart') as HTMLCanvasElement;
		if (!ctx) return;

		scoresByGroupChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: scoresByGroupData.labels,
				datasets: [
					{
						label: 'Promedio de Puntaje',
						data: scoresByGroupData.values,
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
	}

	// Render scores by course chart
	function renderScoresByCourseChart() {
		if (!scoresByCourseData.labels.length) return;

		const ctx = document.getElementById('scoresByCourseChart') as HTMLCanvasElement;
		if (!ctx) return;

		scoresByCourseChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: scoresByCourseData.labels,
				datasets: [
					{
						label: 'Promedio de Puntaje',
						data: scoresByCourseData.values,
						backgroundColor: chartColors.tertiary,
						borderColor: chartColors.tertiary,
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
						text: 'Puntajes Promedio por Curso'
					}
				}
			}
		});
	}

	// Render correct vs incorrect chart
	function renderCorrectVsIncorrectChart() {
		if (!correctVsIncorrectData.values.length) return;

		const ctx = document.getElementById('correctVsIncorrectChart') as HTMLCanvasElement;
		if (!ctx) return;

		correctVsIncorrectChart = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: ['Correctas', 'Incorrectas', 'En blanco'],
				datasets: [
					{
						data: correctVsIncorrectData.values,
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
	}

	// Render student performance chart
	function renderStudentPerformanceChart() {
		if (!studentPerformanceData.labels.length) return;

		const ctx = document.getElementById('studentPerformanceChart') as HTMLCanvasElement;
		if (!ctx) return;

		studentPerformanceChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: studentPerformanceData.labels,
				datasets: [
					{
						label: 'Promedio de Puntaje',
						data: studentPerformanceData.values,
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
	}

	// Destroy all charts
	function destroyCharts() {
		if (scoresByEvalChart) {
			scoresByEvalChart.destroy();
			scoresByEvalChart = null;
		}

		if (scoresByGroupChart) {
			scoresByGroupChart.destroy();
			scoresByGroupChart = null;
		}

		if (scoresByCourseChart) {
			scoresByCourseChart.destroy();
			scoresByCourseChart = null;
		}

		if (correctVsIncorrectChart) {
			correctVsIncorrectChart.destroy();
			correctVsIncorrectChart = null;
		}

		if (studentPerformanceChart) {
			studentPerformanceChart.destroy();
			studentPerformanceChart = null;
		}
	}
</script>

<PageTitle title={data.title} description="Estadísticas y análisis de rendimiento">
	<div></div>
</PageTitle>

<div class="p-4 bg-base-200 rounded-box mb-4">
	<div class="flex flex-col sm:flex-row items-center gap-4">
		<select
			class="select w-full sm:w-auto"
			bind:value={selectedLevelCode}
			onchange={() => loadDashboardData(selectedLevelCode)}
		>
			<option value="" disabled selected>Selecciona un nivel</option>
			{#each data.levels as level (level.code)}
				<option value={level.code}>{level.name}</option>
			{/each}
		</select>
	</div>
</div>

{#if isLoading}
	<div class="flex justify-center items-center h-64">
		<div class="loading loading-spinner loading-lg text-primary"></div>
	</div>
{:else if !selectedLevelCode}
	<div class="card bg-base-200 shadow-sm">
		<div class="card-body text-center">
			<div class="w-16 h-16 mx-auto text-base-content opacity-50">📊</div>
			<h2 class="text-xl font-semibold mt-4">Selecciona un nivel para ver estadísticas</h2>
			<p class="text-base-content/70">
				Visualiza el rendimiento de estudiantes, grupos y evaluaciones
			</p>
		</div>
	</div>
{:else if chartData}
	{#if scoresByEvalData.labels.length || scoresByGroupData.labels.length || scoresByCourseData.labels.length || correctVsIncorrectData.values.length || studentPerformanceData.labels.length}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Scores by Evaluation Chart -->
			{#if scoresByEvalData.labels.length}
				<div class="card bg-base-200 shadow-sm">
					<div class="card-body">
						<div class="flex items-center gap-2 mb-2">
							<div class="w-5 h-5 text-primary">📈</div>
							<h3 class="card-title text-lg">Evolución de Puntajes</h3>
						</div>
						<div class="h-64 relative">
							<canvas id="scoresByEvalChart"></canvas>
						</div>
					</div>
				</div>
			{/if}

			<!-- Scores by Group Chart -->
			{#if scoresByGroupData.labels.length}
				<div class="card bg-base-200 shadow-sm">
					<div class="card-body">
						<div class="flex items-center gap-2 mb-2">
							<div class="w-5 h-5 text-secondary">📊</div>
							<h3 class="card-title text-lg">Puntajes por Grupo</h3>
						</div>
						<div class="h-64 relative">
							<canvas id="scoresByGroupChart"></canvas>
						</div>
					</div>
				</div>
			{/if}

			<!-- Scores by Course Chart -->
			{#if scoresByCourseData.labels.length}
				<div class="card bg-base-200 shadow-sm">
					<div class="card-body">
						<div class="flex items-center gap-2 mb-2">
							<div class="w-5 h-5 text-tertiary">📚</div>
							<h3 class="card-title text-lg">Puntajes por Curso</h3>
						</div>
						<div class="h-64 relative">
							<canvas id="scoresByCourseChart"></canvas>
						</div>
					</div>
				</div>
			{/if}

			<!-- Correct vs Incorrect Chart -->
			{#if correctVsIncorrectData.values.length}
				<div class="card bg-base-200 shadow-sm">
					<div class="card-body">
						<div class="flex items-center gap-2 mb-2">
							<div class="w-5 h-5 text-accent">🍩</div>
							<h3 class="card-title text-lg">Distribución de Respuestas</h3>
						</div>
						<div class="h-64 relative">
							<canvas id="correctVsIncorrectChart"></canvas>
						</div>
					</div>
				</div>
			{/if}

			<!-- Student Performance Chart -->
			{#if studentPerformanceData.labels.length}
				<div class="card bg-base-200 shadow-sm">
					<div class="card-body">
						<div class="flex items-center gap-2 mb-2">
							<div class="w-5 h-5 text-warning">🏆</div>
							<h3 class="card-title text-lg">Top 10 Estudiantes</h3>
						</div>
						<div class="h-64 relative">
							<canvas id="studentPerformanceChart"></canvas>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="card bg-base-200 shadow-sm">
			<div class="card-body text-center">
				<h2 class="text-xl font-semibold">No hay datos disponibles</h2>
				<p class="text-base-content/70">No se encontraron resultados para el nivel seleccionado</p>
				<p class="text-base-content/70 mt-2">
					Asegúrate de que existan evaluaciones y resultados registrados para este nivel
				</p>
			</div>
		</div>
	{/if}
{:else}
	<div class="card bg-base-200 shadow-sm">
		<div class="card-body text-center">
			<h2 class="text-xl font-semibold">No hay datos disponibles</h2>
			<p class="text-base-content/70">No se encontraron datos para el nivel seleccionado</p>
		</div>
	</div>
{/if}
