<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast.js';
	import { User, Search, Activity, ChartPie } from 'lucide-svelte';
	import type { Student, StudentScoreEvolution, StudentCourseScore, StudentCourseEvolution } from '$lib/types';
	import { studentStore } from '$lib/stores/student';
	import StudentCard from '$lib/components/StudentCard.svelte';

	// We don't need to use the props in this component
	// as we're using a student search instead

	// Import the types we need
	import type { StudentRegister, StudentResult } from '$lib/types';

	// Store state
	let storeState = $state({
		selectedStudent: null as Student | null,
		registers: [] as StudentRegister[],
		results: [] as StudentResult[],
		selectedRegister: null as string | null,
		isLoading: false
	});

	// Subscribe to the store
	$effect(() => {
		const unsubscribe = studentStore.subscribe((state) => {
			storeState = state;
		});
		return unsubscribe;
	});

	// Local state
	let searchQuery = $state('');
	let searchResults = $state<Student[]>([]);
	let dashboardLoading = $state(false);
	let scoreEvolutionData = $state<StudentScoreEvolution[] | null>(null);
	let courseScoresData = $state<StudentCourseScore[] | null>(null);
	let courseEvolutionData = $state<StudentCourseEvolution[] | null>(null);
	let modal: HTMLDialogElement | null = $state(null);

	// Chart references
	let scoreEvolutionChart: Chart | null = $state(null);
	let courseScoresChart: Chart | null = $state(null);
	let courseEvolutionChart: Chart | null = $state(null);

	// Colors for charts
	const chartColors = {
		primary: 'rgba(100, 220, 150, 0.8)',
		secondary: 'rgba(54, 162, 235, 0.8)',
		tertiary: 'rgba(255, 206, 86, 0.8)',
		quaternary: 'rgba(255, 99, 132, 0.8)'
	};

	// Derived values for chart data
	const scoreEvolutionChartData = $derived(prepareScoreEvolutionData(scoreEvolutionData));
	const courseScoresChartData = $derived(prepareCourseScoresData(courseScoresData));
	const courseEvolutionChartData = $derived(prepareCourseEvolutionData(courseEvolutionData));

	// Track chart data changes and render charts when data is available
	const shouldRenderScoreEvolutionChart = $derived(
		scoreEvolutionData !== null && !dashboardLoading && scoreEvolutionData.length > 0
	);
	const shouldRenderCourseScoresChart = $derived(
		courseScoresData !== null && !dashboardLoading && courseScoresData.length > 0
	);
	const shouldRenderCourseEvolutionChart = $derived(
		courseEvolutionData !== null && !dashboardLoading && courseEvolutionData.length > 0
	);

	// Render charts when data changes
	$effect(() => {
		if (shouldRenderScoreEvolutionChart) {
			renderScoreEvolutionChart();
		}
	});

	$effect(() => {
		if (shouldRenderCourseScoresChart) {
			renderCourseScoresChart();
		}
	});

	$effect(() => {
		if (shouldRenderCourseEvolutionChart) {
			renderCourseEvolutionChart();
		}
	});

	// Clean up charts on unmount
	onMount(() => {
		return () => {
			destroyCharts();
		};
	});

	/**
	 * Destroy all charts to prevent memory leaks
	 */
	function destroyCharts() {
		if (scoreEvolutionChart) {
			scoreEvolutionChart.destroy();
			scoreEvolutionChart = null;
		}
		if (courseScoresChart) {
			courseScoresChart.destroy();
			courseScoresChart = null;
		}
	}

	/**
	 * Open student search modal
	 */
	function openStudentSearchModal() {
		modal?.showModal();
	}

	/**
	 * Close student search modal
	 */
	function closeStudentSearchModal() {
		modal?.close();
		searchQuery = '';
		searchResults = [];
	}

	/**
	 * Handle key down event for search input
	 * @param event Keyboard event
	 */
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			searchStudents();
		}
	}

	/**
	 * Search for students by name or last name
	 */
	async function searchStudents() {
		if (!searchQuery.trim()) return;

		try {
			const response = await fetch(`/api/student?search=${encodeURIComponent(searchQuery.trim())}`);
			if (!response.ok) {
				throw new Error('Error al buscar estudiantes');
			}
			searchResults = await response.json();
		} catch (error) {
			console.error('Error searching students:', error);
			showToast('Error al buscar estudiantes', 'danger');
			searchResults = [];
		}
	}

	/**
	 * Select a student and load their dashboard data
	 * @param student Student to select
	 */
	function selectStudent(student: Student) {
		// Use the store to select the student
		studentStore.selectStudent(student, 'dashboard-student-page');
		closeStudentSearchModal();
		loadStudentDashboardData(student.code);
	}

	/**
	 * Load dashboard data for a student
	 * @param studentCode Student code to load data for
	 */
	async function loadStudentDashboardData(studentCode: string) {
		dashboardLoading = true;
		destroyCharts();

		try {
			// Load score evolution, course scores, and course evolution in parallel
			const [scoreEvolutionResponse, courseScoresResponse, courseEvolutionResponse] = await Promise.all([
				fetch(`/api/dashboard/student/scores/${studentCode}`),
				fetch(`/api/dashboard/student/courses/${studentCode}`),
				fetch(`/api/dashboard/student/course-evolution/${studentCode}`)
			]);

			// Handle score evolution response
			if (!scoreEvolutionResponse.ok) {
				const errorData = await scoreEvolutionResponse.json().catch(() => ({}));
				const errorMessage = errorData.error || 'Error al cargar datos de evolución de puntajes';
				throw new Error(errorMessage);
			}

			// Handle course scores response
			if (!courseScoresResponse.ok) {
				const errorData = await courseScoresResponse.json().catch(() => ({}));
				const errorMessage = errorData.error || 'Error al cargar datos de cursos';
				throw new Error(errorMessage);
			}

			// Handle course evolution response
			if (!courseEvolutionResponse.ok) {
				const errorData = await courseEvolutionResponse.json().catch(() => ({}));
				const errorMessage = errorData.error || 'Error al cargar datos de evolución por curso';
				throw new Error(errorMessage);
			}

			// Parse response data
			const scoreEvolution = await scoreEvolutionResponse.json();
			const courseScores = await courseScoresResponse.json();
			const courseEvolution = await courseEvolutionResponse.json();

			// Update state with response data
			scoreEvolutionData = scoreEvolution;
			courseScoresData = courseScores;
			courseEvolutionData = courseEvolution;
		} catch (error) {
			console.error('Error loading student dashboard data:', error);
			showToast(
				error instanceof Error ? error.message : 'No se pudieron cargar los datos del dashboard',
				'danger'
			);
			scoreEvolutionData = null;
			courseScoresData = null;
			courseEvolutionData = null;
		} finally {
			dashboardLoading = false;
		}
	}

	/**
	 * Prepare data for score evolution chart
	 * @param data Score evolution data
	 * @returns Formatted data for chart
	 */
	function prepareScoreEvolutionData(data: StudentScoreEvolution[] | null) {
		if (!data || !Array.isArray(data) || !data.length) {
			return { labels: [], values: [] };
		}

		try {
			// Sort data by date
			const sortedData = [...data].sort(
				(a, b) => new Date(a.eval_date).getTime() - new Date(b.eval_date).getTime()
			);

			return {
				labels: sortedData.map((item) => item.eval_name || 'Sin nombre'),
				values: sortedData.map((item) => item.score || 0)
			};
		} catch (error) {
			console.error('Error processing score evolution data:', error);
			return { labels: [], values: [] };
		}
	}

	/**
	 * Prepare data for course scores chart
	 * @param data Course scores data
	 * @returns Formatted data for chart
	 */
	function prepareCourseScoresData(data: StudentCourseScore[] | null) {
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
	 * Prepare data for course evolution chart
	 * @param data Course evolution data
	 * @returns Formatted data for chart
	 */
	function prepareCourseEvolutionData(data: StudentCourseEvolution[] | null) {
		if (!data || !Array.isArray(data) || !data.length) {
			return { labels: [], datasets: [] };
		}

		try {
			// Group data by course
			const courseGroups = data.reduce((acc, item) => {
				const courseName = item.course_name || 'Sin nombre';
				if (!acc[courseName]) {
					acc[courseName] = [];
				}
				acc[courseName].push(item);
				return acc;
			}, {} as Record<string, StudentCourseEvolution[]>);

			// Get all unique evaluation names sorted by date
			const allEvals = [...data].sort(
				(a, b) => new Date(a.eval_date).getTime() - new Date(b.eval_date).getTime()
			);
			const uniqueEvals = Array.from(new Set(allEvals.map(item => item.eval_name)));

			// Create datasets for each course
			const courseNames = Object.keys(courseGroups);
			const datasets = courseNames.map((courseName, index) => {
				const courseData = courseGroups[courseName];
				const dataPoints = uniqueEvals.map(evalName => {
					const evalData = courseData.find(item => item.eval_name === evalName);
					return evalData ? evalData.score : null;
				});

				const colors = [
					chartColors.primary,
					chartColors.secondary,
					chartColors.tertiary,
					chartColors.quaternary,
					'rgba(153, 102, 255, 0.8)',
					'rgba(255, 159, 64, 0.8)'
				];

				return {
					label: courseName,
					data: dataPoints,
					borderColor: colors[index % colors.length],
					backgroundColor: colors[index % colors.length].replace('0.8', '0.1'),
					borderWidth: 2,
					fill: false,
					tension: 0.4,
					spanGaps: false
				};
			});

			return {
				labels: uniqueEvals,
				datasets
			};
		} catch (error) {
			console.error('Error processing course evolution data:', error);
			return { labels: [], datasets: [] };
		}
	}

	/**
	 * Render score evolution chart
	 */
	function renderScoreEvolutionChart() {
		if (!scoreEvolutionChartData.labels.length) return;

		// Ensure DOM is ready before rendering
		setTimeout(() => {
			const ctx = document.getElementById('scoreEvolutionChart') as HTMLCanvasElement;
			if (!ctx) return;

			// Destroy existing chart if it exists
			if (scoreEvolutionChart) scoreEvolutionChart.destroy();

			scoreEvolutionChart = new Chart(ctx, {
				type: 'line',
				data: {
					labels: scoreEvolutionChartData.labels,
					datasets: [
						{
							label: 'Puntaje',
							data: scoreEvolutionChartData.values,
							borderColor: chartColors.primary,
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
									const value = context.raw as number;
									return `Puntaje: ${value.toFixed(2)}`;
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
							max: 20,
							title: {
								display: true,
								text: 'Puntaje'
							}
						}
					}
				}
			});
		}, 50);
	}

	/**
	 * Render course scores chart
	 */
	function renderCourseScoresChart() {
		if (!courseScoresChartData.labels.length) return;

		// Ensure DOM is ready before rendering
		setTimeout(() => {
			const ctx = document.getElementById('courseScoresChart') as HTMLCanvasElement;
			if (!ctx) return;

			// Destroy existing chart if it exists
			if (courseScoresChart) courseScoresChart.destroy();

			courseScoresChart = new Chart(ctx, {
				type: 'doughnut',
				data: {
					labels: courseScoresChartData.labels,
					datasets: [
						{
							label: 'Promedio de Puntajes',
							data: courseScoresChartData.values,
							backgroundColor: [
								chartColors.primary,
								chartColors.secondary,
								chartColors.tertiary,
								chartColors.quaternary,
								'rgba(153, 102, 255, 0.8)',
								'rgba(255, 159, 64, 0.8)',
								'rgba(75, 192, 192, 0.8)',
								'rgba(201, 203, 207, 0.8)'
							],
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
	 * Render course evolution chart
	 */
	function renderCourseEvolutionChart() {
		if (!courseEvolutionChartData.labels.length || !courseEvolutionChartData.datasets.length) return;

		// Ensure DOM is ready before rendering
		setTimeout(() => {
			const ctx = document.getElementById('courseEvolutionChart') as HTMLCanvasElement;
			if (!ctx) return;

			// Destroy existing chart if it exists
			if (courseEvolutionChart) courseEvolutionChart.destroy();

			courseEvolutionChart = new Chart(ctx, {
				type: 'line',
				data: {
					labels: courseEvolutionChartData.labels,
					datasets: courseEvolutionChartData.datasets
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: true,
							position: 'top'
						},
						tooltip: {
							callbacks: {
								label: function (context) {
									const label = context.dataset.label || '';
									const value = context.raw as number;
									return value !== null ? `${label}: ${value.toFixed(2)}` : `${label}: Sin datos`;
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
							max: 20,
							title: {
								display: true,
								text: 'Puntaje'
							}
						}
					}
				}
			});
		}, 50);
	}
</script>

<PageTitle
	title="Dashboard de Estudiante"
	description="Visualiza la evolución de puntajes y promedios por curso de un estudiante."
>
	<button class="btn btn-primary" onclick={openStudentSearchModal} aria-label="Buscar estudiante">
		<User size={18} class="mr-2" />
		{storeState.selectedStudent ? 'Cambiar Estudiante' : 'Buscar Estudiante'}
	</button>
</PageTitle>

<main class="container mx-auto p-4">
	{#if !storeState.selectedStudent}
		<div
			class="card bg-gradient-to-br from-base-200 to-base-100 border border-base-300/30 rounded-xl overflow-hidden"
		>
			<div class="card-body p-8 text-center">
				<div
					class="w-20 h-20 mx-auto bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4"
				>
					<User class="w-10 h-10" />
				</div>
				<h2 class="text-2xl font-semibold">Dashboard de Estudiante</h2>
				<p class="text-base-content/70 text-lg mt-2 max-w-md mx-auto">
					Visualiza la evolución de puntajes y promedios por curso de un estudiante
				</p>
				<div class="divider"></div>
				<p class="text-base-content/70 mt-2">
					Haz clic en "Buscar Estudiante" para comenzar a visualizar los datos
				</p>
			</div>
		</div>
	{:else if dashboardLoading}
		<div
			class="flex justify-center items-center h-64 bg-base-200 rounded-xl border border-base-300/30 p-6"
		>
			<div class="loading loading-spinner loading-lg text-primary"></div>
			<span class="ml-4 text-base-content/70 text-lg">Cargando datos del dashboard...</span>
		</div>
	{:else}
		<!-- Student Card -->
		<StudentCard className="mb-6" />

		<!-- Dashboard Content -->
		<div class="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
			<!-- Score Evolution Chart -->
			<div
				class="card bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl overflow-hidden"
			>
				<div class="card-body p-5">
					<div class="flex items-center gap-3 mb-3">
						<div
							class="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/15 text-primary"
						>
							<Activity class="h-5 w-5" />
						</div>
						<h3 class="text-lg font-medium">Evolución de Notas</h3>
					</div>
					<div class="divider my-0"></div>
					{#if !scoreEvolutionData || scoreEvolutionData.length === 0}
						<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
							<div class="text-4xl mb-4">📈</div>
							<p class="text-lg font-medium">No hay datos disponibles</p>
							<p class="text-sm mt-2">No se encontraron evaluaciones para este estudiante</p>
						</div>
					{:else}
						<div class="h-80 relative mt-2">
							<canvas id="scoreEvolutionChart"></canvas>
						</div>
					{/if}
				</div>
			</div>

			<!-- Course Scores Chart -->
			<div
				class="card bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20 rounded-xl overflow-hidden"
			>
				<div class="card-body p-5">
					<div class="flex items-center gap-3 mb-3">
						<div
							class="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary/15 text-secondary"
						>
							<ChartPie class="h-5 w-5" />
						</div>
						<h3 class="text-lg font-medium">Puntajes por Curso</h3>
					</div>
					<div class="divider my-0"></div>
					{#if !courseScoresData || courseScoresData.length === 0}
						<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
							<div class="text-4xl mb-4">📊</div>
							<p class="text-lg font-medium">No hay datos disponibles</p>
							<p class="text-sm mt-2">No se encontraron cursos para este estudiante</p>
						</div>
					{:else}
						<div class="h-80 relative mt-2">
							<canvas id="courseScoresChart"></canvas>
						</div>
					{/if}
				</div>
			</div>

			<!-- Course Evolution Chart -->
			<div
				class="card bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl overflow-hidden"
			>
				<div class="card-body p-5">
					<div class="flex items-center gap-3 mb-3">
						<div
							class="w-8 h-8 flex items-center justify-center rounded-lg bg-accent/15 text-accent"
						>
							<Activity class="h-5 w-5" />
						</div>
						<h3 class="text-lg font-medium">Evolución por Curso</h3>
					</div>
					<div class="divider my-0"></div>
					{#if !courseEvolutionData || courseEvolutionData.length === 0}
						<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
							<div class="text-4xl mb-4">📈</div>
							<p class="text-lg font-medium">No hay datos disponibles</p>
							<p class="text-sm mt-2">No se encontraron datos de evolución por curso</p>
						</div>
					{:else}
						<div class="h-80 relative mt-2">
							<canvas id="courseEvolutionChart"></canvas>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</main>

<!-- Student Search Modal -->
<dialog id="studentSearchModal" class="modal" bind:this={modal}>
	<div class="modal-box">
		<h3 class="font-bold text-lg mb-4">Buscar Estudiante</h3>
		<div class="join w-full mb-4">
			<input
				type="text"
				placeholder="Buscar por nombre o apellido"
				class="input input-bordered join-item flex-1"
				bind:value={searchQuery}
				onkeydown={handleKeyDown}
			/>
			<button
				class="btn btn-primary join-item"
				onclick={searchStudents}
				disabled={!searchQuery.trim()}
			>
				<Search class="w-4 h-4" />
			</button>
		</div>
		{#if searchResults.length > 0}
			<ul class="space-y-2 max-h-48 overflow-y-auto p-4">
				{#each searchResults as student (student.code)}
					<li
						class="bg-base-200 p-3 rounded-box hover:bg-base-300 transition-colors cursor-pointer"
					>
						<button class="w-full text-left" onclick={() => selectStudent(student)}>
							{student.name}
							{student.last_name}
						</button>
					</li>
				{/each}
			</ul>
		{:else if searchQuery}
			<div class="text-center p-4 text-base-content/70">
				<p>No se encontraron estudiantes con ese nombre</p>
			</div>
		{/if}
		<div class="modal-action">
			<button class="btn" onclick={closeStudentSearchModal}>Cerrar</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>cerrar</button>
	</form>
</dialog>
