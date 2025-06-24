<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import EvalSelector from '$lib/components/EvalSelector.svelte';
	import { showToast } from '$lib/stores/Toast.js';
	import { School, ChartPie, Activity, CircleDot } from 'lucide-svelte';
	import type { Levels, EvalWithSections } from '$lib/types';
	import type { EvalDashboardData, QuestionStat } from '$lib/types/dashboard/eval';
	import { goto } from '$app/navigation';
	import { evaluationStore } from '$lib/stores/evaluation';

	// Props from server
	const { data } = $props<{
		data: {
			levels: Levels[];
			title: string;
			levelCode: string | null;
			evalCode: string | null;
		};
	}>();

	// Store state
	let storeState = $state({
		selectedEval: null as EvalWithSections | null,
		selectedLevelCode: '',
		availableEvals: [] as EvalWithSections[],
		isLoading: false
	});

	// Subscribe to the store
	$effect(() => {
		const unsubscribe = evaluationStore.subscribe((state) => {
			storeState = state;
		});
		return unsubscribe;
	});

	// Initialize the store from URL parameters
	onMount(() => {
		if (data.levelCode) {
			evaluationStore.initFromUrl(data.levelCode, data.evalCode, 'dashboard-eval-page');
		}
	});

	// State
	let evalSelectionModalOpen = $state(false);
	let loadingDashboard = $state(false);
	let dashboardData = $state<EvalDashboardData | null>(null);

	// Chart references
	let questionsChart: Chart | null = $state(null);
	let scoreDistributionChart: Chart | null = $state(null);

	// Colors for charts
	const chartColors = {
		primary: 'rgba(100, 220, 150, 0.8)',
		secondary: 'rgba(54, 162, 235, 0.8)',
		tertiary: 'rgba(255, 206, 86, 0.8)',
		quaternary: 'rgba(255, 99, 132, 0.8)',
		correct: 'rgba(75, 192, 192, 0.8)',
		incorrect: 'rgba(255, 99, 132, 0.8)',
		middle: 'rgba(255, 206, 86, 0.8)'
	};

	// Track chart data changes and render charts when data is available
	let shouldRenderCharts = $derived(dashboardData !== null && !loadingDashboard);

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

	// Functions
	function openEvalModal() {
		evalSelectionModalOpen = true;
	}

	// Update URL when selection changes
	$effect(() => {
		if (storeState.selectedLevelCode) {
			// Update URL with current selection
			goto(
				`/dashboard/eval?level=${storeState.selectedLevelCode}${storeState.selectedEval ? `&eval=${storeState.selectedEval.code}` : ''}`,
				{
					keepFocus: true,
					noScroll: true,
					replaceState: true
				}
			);
		}
	});

	async function loadDashboardData(evalCode: string) {
		loadingDashboard = true;
		dashboardData = null;

		try {
			const response = await fetch(`/api/dashboard/eval/${evalCode}`);
			if (!response.ok) {
				throw new Error('Error al cargar datos del dashboard');
			}
			dashboardData = await response.json();
		} catch (error) {
			console.error('Error cargando datos del dashboard:', error);
			showToast('No se pudieron cargar los datos del dashboard', 'danger');
			dashboardData = null;
		} finally {
			loadingDashboard = false;
		}
	}

	function destroyCharts() {
		if (questionsChart) {
			questionsChart.destroy();
			questionsChart = null;
		}
		if (scoreDistributionChart) {
			scoreDistributionChart.destroy();
			scoreDistributionChart = null;
		}
	}

	function renderCharts() {
		if (!dashboardData) return;

		Promise.all([renderQuestionsChart(), renderScoreDistributionChart()]).catch((error) => {
			console.error('Error rendering charts:', error);
		});
	}

	function renderQuestionsChart() {
		return new Promise<void>((resolve, reject) => {
			if (!dashboardData) {
				resolve();
				return;
			}

			const ctx = document.getElementById('questionsChart') as HTMLCanvasElement;
			if (!ctx) {
				console.error('Canvas element not found');
				resolve();
				return;
			}

			try {
				// Prepare data for bubble chart
				const correctBubbles = dashboardData.topCorrectQuestions.map((q: QuestionStat) => ({
					x: q.orderInEval, // X-axis: question number (1-80)
					y: q.totalAnswers, // Y-axis: number of students (0-100)
					r: (q.correctPercentage || 0) / 5, // Radius: percentage / 5 for better visualization
					questionNumber: q.orderInEval,
					courseName: q.courseName,
					percentage: q.correctPercentage || 0,
					count: q.correctCount || 0,
					total: q.totalAnswers
				}));

				const incorrectBubbles = dashboardData.topIncorrectQuestions.map((q: QuestionStat) => ({
					x: q.orderInEval, // X-axis: question number (1-80)
					y: q.totalAnswers, // Y-axis: number of students (0-100)
					r: (q.incorrectPercentage || 0) / 5, // Radius: percentage / 5 for better visualization
					questionNumber: q.orderInEval,
					courseName: q.courseName,
					percentage: q.incorrectPercentage || 0,
					count: q.incorrectCount || 0,
					total: q.totalAnswers
				}));

				questionsChart = new Chart(ctx, {
					type: 'bubble',
					data: {
						datasets: [
							{
								label: 'Preguntas con más aciertos',
								data: correctBubbles,
								backgroundColor: chartColors.correct,
								borderColor: chartColors.correct,
								borderWidth: 1
							},
							{
								label: 'Preguntas con más errores',
								data: incorrectBubbles,
								backgroundColor: chartColors.incorrect,
								borderColor: chartColors.incorrect,
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
								max: 100,
								title: {
									display: true,
									text: 'Número de estudiantes'
								}
							},
							x: {
								min: 0,
								max: 80,
								title: {
									display: true,
									text: 'Número de pregunta'
								}
							}
						},
						plugins: {
							title: {
								display: true,
								text: 'Preguntas con más aciertos y errores'
							},
							tooltip: {
								callbacks: {
									label: function (context) {
										const item = context.raw as {
											questionNumber: number;
											courseName: string;
											percentage: number;
											count: number;
											total: number;
										};
										return [
											`Pregunta ${item.questionNumber} (${item.courseName})`,
											`${context.dataset.label}: ${item.percentage.toFixed(2)}%`,
											`${item.count} de ${item.total} estudiantes`
										];
									}
								}
							}
						}
					}
				});
				resolve();
			} catch (error) {
				console.error('Error rendering questions chart:', error);
				reject(error);
			}
		});
	}

	function renderScoreDistributionChart() {
		return new Promise<void>((resolve, reject) => {
			if (!dashboardData) {
				resolve();
				return;
			}

			const ctx = document.getElementById('scoreDistributionChart') as HTMLCanvasElement;
			if (!ctx) {
				console.error('Canvas element not found');
				resolve();
				return;
			}

			try {
				const { approved, middle, failed } = dashboardData.scoreDistribution;

				scoreDistributionChart = new Chart(ctx, {
					type: 'doughnut',
					data: {
						labels: ['Aprobados (≥14)', 'Regulares (10-14)', 'Desaprobados (<10)'],
						datasets: [
							{
								data: [approved, middle, failed],
								backgroundColor: [chartColors.primary, chartColors.middle, chartColors.incorrect],
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
								text: 'Distribución de Notas'
							},
							tooltip: {
								callbacks: {
									label: function (context) {
										const value = context.raw as number;
										return `${context.label}: ${value.toFixed(2)}%`;
									}
								}
							}
						}
					}
				});
				resolve();
			} catch (error) {
				console.error('Error rendering score distribution chart:', error);
				reject(error);
			}
		});
	}

	// Load dashboard data when evaluation changes
	$effect(() => {
		if (storeState.selectedEval) {
			loadDashboardData(storeState.selectedEval.code);
		}
	});
</script>

<PageTitle
	title="Dashboard de Evaluación"
	description="Visualiza estadísticas detalladas de una evaluación específica."
>
	<button
		class="btn btn-outline btn-primary"
		onclick={openEvalModal}
		aria-label="Seleccionar evaluación"
	>
		<School size={20} class="mr-2" />
		{storeState.selectedEval ? `${storeState.selectedEval.name}` : 'Seleccionar'}
	</button>
</PageTitle>

<main class="container mx-auto p-4">
	{#if storeState.selectedEval && dashboardData}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<!-- Questions Chart -->
			<div
				class="card bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl overflow-hidden"
			>
				<div class="card-body p-5">
					<div class="flex items-center gap-3 mb-3">
						<div
							class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/15 text-primary"
						>
							<CircleDot class="h-5 w-5" />
						</div>
						<h3 class="text-lg font-medium">Preguntas con más aciertos y errores</h3>
					</div>
					<div class="divider my-0"></div>
					<div class="h-64 relative mt-2">
						<canvas id="questionsChart"></canvas>
					</div>
				</div>
			</div>

			<!-- Score Distribution Chart -->
			<div
				class="card bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl overflow-hidden"
			>
				<div class="card-body p-5">
					<div class="flex items-center gap-3 mb-3">
						<div
							class="w-8 h-8 flex items-center justify-center rounded-lg bg-accent/15 text-accent"
						>
							<ChartPie class="h-5 w-5" />
						</div>
						<h3 class="text-lg font-medium">Distribución de Notas</h3>
					</div>
					<div class="divider my-0"></div>
					<div class="h-64 relative mt-2">
						<canvas id="scoreDistributionChart"></canvas>
					</div>
				</div>
			</div>
		</div>

		<!-- Score Distribution Details -->
		<div class="card bg-base-100 border border-base-300/30 rounded-xl mb-8">
			<div class="card-body p-5">
				<div class="flex items-center gap-3 mb-3">
					<div
						class="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/15 text-secondary"
					>
						<Activity class="h-5 w-5" />
					</div>
					<h3 class="text-lg font-medium">Detalle de Distribución de Notas</h3>
				</div>
				<div class="divider my-0"></div>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
					<div class="stat bg-primary/10 rounded-lg p-4">
						<div class="stat-title">Aprobados (≥14)</div>
						<div class="stat-value text-primary">
							{dashboardData.scoreDistribution.approved.toFixed(2)}%
						</div>
						<div class="stat-desc">{dashboardData.scoreDistribution.approvedCount} estudiantes</div>
					</div>
					<div class="stat bg-warning/10 rounded-lg p-4">
						<div class="stat-title">Regulares (10-14)</div>
						<div class="stat-value text-warning">
							{dashboardData.scoreDistribution.middle.toFixed(2)}%
						</div>
						<div class="stat-desc">{dashboardData.scoreDistribution.middleCount} estudiantes</div>
					</div>
					<div class="stat bg-error/10 rounded-lg p-4">
						<div class="stat-title">Desaprobados (menor a 10)</div>
						<div class="stat-value text-error">
							{dashboardData.scoreDistribution.failed.toFixed(2)}%
						</div>
						<div class="stat-desc">{dashboardData.scoreDistribution.failedCount} estudiantes</div>
					</div>
				</div>
			</div>
		</div>
	{:else if loadingDashboard}
		<div class="flex justify-center items-center h-64">
			<span class="loading loading-spinner loading-lg text-primary"></span>
		</div>
	{:else}
		<div
			class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl"
		>
			<div class="card-body flex flex-col items-center justify-center p-8 text-center">
				<div class="bg-base-100/50 rounded-lg border border-base-300/30 p-8 w-full max-w-md">
					<School size={64} class="text-primary/30 mx-auto mb-4" />
					<h3 class="text-lg font-bold mb-2">Selecciona una evaluación</h3>
					<p class="text-base-content/70 mb-4">
						Para ver las estadísticas, primero debes seleccionar una evaluación.
					</p>
				</div>
			</div>
		</div>
	{/if}
</main>

<EvalSelector
	levels={data.levels}
	availableEvals={storeState.availableEvals}
	selectedEval={storeState.selectedEval}
	selectedLevelCode={storeState.selectedLevelCode}
	open={evalSelectionModalOpen}
	loading={storeState.isLoading}
	onClose={() => (evalSelectionModalOpen = false)}
	onLevelChange={(levelCode) => evaluationStore.setLevelCode(levelCode, 'dashboard-eval-page')}
	onSelectEval={(eval_item) => {
		evaluationStore.setSelectedEval(eval_item);
		loadDashboardData(eval_item.code);
	}}
/>
