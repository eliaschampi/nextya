<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast.js';
	import { User, Activity, ChartPie } from 'lucide-svelte';
	import type {
		Students,
		StudentScoreEvolution,
		StudentCourseScore,
		StudentCourseEvolution
	} from '$lib/types';
	import { studentStore } from '$lib/stores/student';
	import StudentCard from '$lib/components/StudentCard.svelte';
	import StudentSearchModal from '$lib/components/StudentSearchModal.svelte';

	// Store state
	let storeState = $state({
		selectedStudent: null as Students | null,
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
	let studentSearchModalOpen = $state(false);
	let dashboardLoading = $state(false);
	let scoreEvolutionData = $state<StudentScoreEvolution[] | null>(null);
	let courseScoresData = $state<StudentCourseScore[] | null>(null);
	let courseEvolutionData = $state<StudentCourseEvolution[] | null>(null);
	let selectedCourseForEvolution = $state<string | null>(null);
	let availableCourses = $state<StudentCourseScore[]>([]);

	// Chart references
	let scoreEvolutionChart: Chart | null = $state(null);
	let courseScoresChart: Chart | null = $state(null);
	let courseEvolutionChart: Chart | null = $state(null);

	// Colors for charts
	const chartColors = {
		primary: 'rgba(100, 220, 150, 0.8)',
		secondary: 'rgba(54, 162, 235, 0.8)',
		tertiary: 'rgba(255, 206, 86, 0.8)',
		quaternary: 'rgba(255, 99, 132, 0.8)',
		extended: [
			'rgba(153, 102, 255, 0.8)',
			'rgba(255, 159, 64, 0.8)',
			'rgba(75, 192, 192, 0.8)',
			'rgba(201, 203, 207, 0.8)'
		]
	};

	// Common chart options
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

	// Handle course selection changes
	$effect(() => {
		if (selectedCourseForEvolution && storeState.selectedStudent) {
			// Load course evolution data for the selected course
			const selectedCourse = availableCourses.find(
				(course) => course.course_name === selectedCourseForEvolution
			);
			if (selectedCourse) {
				loadCourseEvolutionData(storeState.selectedStudent.code, selectedCourse.course_code);
			}
		} else {
			// Clear course evolution data when no course is selected
			courseEvolutionData = null;
			if (courseEvolutionChart) {
				courseEvolutionChart.destroy();
				courseEvolutionChart = null;
			}
		}
	});

	// Initialize dashboard data if student is already selected
	onMount(() => {
		// Check if there's already a selected student and load dashboard data
		if (storeState.selectedStudent) {
			loadStudentDashboardData(storeState.selectedStudent.code);
		}

		// Clean up charts on unmount
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
		if (courseEvolutionChart) {
			courseEvolutionChart.destroy();
			courseEvolutionChart = null;
		}
	}

	// Helper functions
	const openStudentSearchModal = () => (studentSearchModalOpen = true);
	const closeStudentSearchModal = () => (studentSearchModalOpen = false);

	/**
	 * Validates and returns empty chart data structure
	 */
	function validateChartData<T, R>(data: T[] | null, emptyStructure: R): R | null {
		if (!data || !Array.isArray(data) || !data.length) {
			return emptyStructure;
		}
		return null; // Valid data
	}

	/**
	 * Handles API response errors consistently
	 */
	async function handleApiResponse(response: Response, errorMessage: string) {
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			const message = errorData.error || errorMessage;
			throw new Error(message);
		}
		return response.json();
	}

	/**
	 * Gets all chart colors including extended palette
	 */
	function getAllChartColors() {
		return [
			chartColors.primary,
			chartColors.secondary,
			chartColors.tertiary,
			chartColors.quaternary,
			...chartColors.extended
		];
	}

	/**
	 * Select a student and load their dashboard data
	 * @param student Student to select
	 */
	function selectStudent(student: Students) {
		// Use the store to select the student
		studentStore.selectStudent(student, 'dashboard-student-page');
		loadStudentDashboardData(student.code);
	}

	/**
	 * Load dashboard data for a student
	 * @param studentCode Student code to load data for
	 */
	async function loadStudentDashboardData(studentCode: string) {
		dashboardLoading = true;
		destroyCharts();

		// Reset course selection state
		selectedCourseForEvolution = null;
		availableCourses = [];
		courseEvolutionData = null;

		try {
			// Load basic data in parallel (excluding course evolution)
			const [scoreEvolutionResponse, courseScoresResponse] = await Promise.all([
				fetch(`/api/dashboard/student/scores/${studentCode}`),
				fetch(`/api/dashboard/student/courses/${studentCode}`)
			]);

			// Handle all responses using helper function
			const [scoreEvolution, courseScores] = await Promise.all([
				handleApiResponse(scoreEvolutionResponse, 'Error al cargar datos de evolución de puntajes'),
				handleApiResponse(courseScoresResponse, 'Error al cargar datos de cursos')
			]);

			// Update state with response data
			scoreEvolutionData = scoreEvolution;
			courseScoresData = courseScores;

			// Set available courses from course scores data
			if (courseScores && Array.isArray(courseScores) && courseScores.length > 0) {
				availableCourses = courseScores;
			}
		} catch (error) {
			console.error('Error loading student dashboard data:', error);
			showToast(
				error instanceof Error ? error.message : 'No se pudieron cargar los datos del dashboard',
				'danger'
			);
			scoreEvolutionData = null;
			courseScoresData = null;
			courseEvolutionData = null;
			availableCourses = [];
		} finally {
			dashboardLoading = false;
		}
	}

	/**
	 * Load course evolution data for a specific course
	 * @param studentCode Student code to load data for
	 * @param courseCode Course code to filter by
	 */
	async function loadCourseEvolutionData(studentCode: string, courseCode: string) {
		// Destroy existing course evolution chart
		if (courseEvolutionChart) {
			courseEvolutionChart.destroy();
			courseEvolutionChart = null;
		}

		try {
			const response = await fetch(
				`/api/dashboard/student/course-evolution/${studentCode}?course_code=${encodeURIComponent(courseCode)}`
			);

			const data = await handleApiResponse(
				response,
				'Error al cargar datos de evolución por curso'
			);
			courseEvolutionData = data;
		} catch (error) {
			console.error('Error loading course evolution data:', error);
			showToast(
				error instanceof Error
					? error.message
					: 'No se pudieron cargar los datos de evolución por curso',
				'danger'
			);
			courseEvolutionData = null;
		}
	}

	/**
	 * Prepare data for score evolution chart
	 */
	function prepareScoreEvolutionData(data: StudentScoreEvolution[] | null) {
		const emptyData = { labels: [], values: [] };
		const validation = validateChartData(data, emptyData);
		if (validation) return validation;

		try {
			const sortedData = [...data!].sort(
				(a, b) => new Date(a.eval_date).getTime() - new Date(b.eval_date).getTime()
			);

			return {
				labels: sortedData.map((item) => item.eval_name || 'Sin nombre'),
				values: sortedData.map((item) => (item.score != null ? Number(item.score) : 0))
			};
		} catch (error) {
			console.error('Error processing score evolution data:', error);
			return emptyData;
		}
	}

	/**
	 * Prepare data for course scores chart
	 */
	function prepareCourseScoresData(data: StudentCourseScore[] | null) {
		const emptyData = { labels: [], values: [] };
		const validation = validateChartData(data, emptyData);
		if (validation) return validation;

		try {
			return {
				labels: data!.map((item) => item.course_name || 'Sin nombre'),
				values: data!.map((item) => (item.average_score != null ? Number(item.average_score) : 0))
			};
		} catch (error) {
			console.error('Error processing course scores data:', error);
			return emptyData;
		}
	}

	/**
	 * Prepare data for course evolution chart
	 */
	function prepareCourseEvolutionData(data: StudentCourseEvolution[] | null) {
		const emptyData = { labels: [], datasets: [] };
		const validation = validateChartData(data, emptyData);
		if (validation) return validation;

		try {
			// Since data is already filtered by course from the backend, we just need to process it
			// Group data by course (should only be one course now, but keeping structure for consistency)
			const courseGroups = data!.reduce(
				(acc, item) => {
					const courseName = item.course_name || 'Sin nombre';
					if (!acc[courseName]) acc[courseName] = [];
					acc[courseName].push(item);
					return acc;
				},
				{} as Record<string, StudentCourseEvolution[]>
			);

			const courseNames = Object.keys(courseGroups);

			// If no courses, return empty data
			if (courseNames.length === 0) {
				return emptyData;
			}

			// Get unique evaluations in chronological order
			const sortedData = [...data!].sort(
				(a, b) => new Date(a.eval_date).getTime() - new Date(b.eval_date).getTime()
			);
			const uniqueEvals = Array.from(new Set(sortedData.map((item) => item.eval_name)));

			// Create datasets
			const allColors = getAllChartColors();
			const datasets = courseNames.map((courseName, index) => {
				const courseData = courseGroups[courseName] || [];
				const dataPoints = uniqueEvals.map((evalName) => {
					const evalData = courseData.find((item) => item.eval_name === evalName);
					return evalData && evalData.score != null ? Number(evalData.score) : null;
				});

				return {
					label: courseName,
					data: dataPoints,
					borderColor: allColors[index % allColors.length],
					backgroundColor: allColors[index % allColors.length].replace('0.8', '0.1'),
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
			return emptyData;
		}
	}

	/**
	 * Render score evolution chart
	 */
	function renderScoreEvolutionChart() {
		if (!scoreEvolutionChartData.labels.length) return;

		setTimeout(() => {
			const ctx = document.getElementById('scoreEvolutionChart') as HTMLCanvasElement;
			if (!ctx) return;

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
					...baseChartOptions,
					plugins: {
						...baseChartOptions.plugins,
						legend: { display: false }
					},
					scales: {
						x: { title: { display: true, text: 'Evaluaciones' } },
						y: { beginAtZero: true, max: 20, title: { display: true, text: 'Puntaje' } }
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

		setTimeout(() => {
			const ctx = document.getElementById('courseScoresChart') as HTMLCanvasElement;
			if (!ctx) return;

			if (courseScoresChart) courseScoresChart.destroy();

			courseScoresChart = new Chart(ctx, {
				type: 'doughnut',
				data: {
					labels: courseScoresChartData.labels,
					datasets: [
						{
							label: 'Promedio de Puntajes',
							data: courseScoresChartData.values,
							backgroundColor: getAllChartColors(),
							borderWidth: 1
						}
					]
				},
				options: {
					...baseChartOptions,
					plugins: {
						...baseChartOptions.plugins,
						legend: {
							position: 'right' as const,
							labels: { font: { size: 12 } }
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
		if (!courseEvolutionChartData.labels.length || !courseEvolutionChartData.datasets.length)
			return;

		setTimeout(() => {
			const ctx = document.getElementById('courseEvolutionChart') as HTMLCanvasElement;
			if (!ctx) return;

			if (courseEvolutionChart) courseEvolutionChart.destroy();

			courseEvolutionChart = new Chart(ctx, {
				type: 'line',
				data: {
					labels: courseEvolutionChartData.labels,
					datasets: courseEvolutionChartData.datasets
				},
				options: {
					...baseChartOptions,
					plugins: {
						...baseChartOptions.plugins,
						legend: { display: true, position: 'top' as const }
					},
					scales: {
						x: { title: { display: true, text: 'Evaluaciones' } },
						y: { beginAtZero: true, max: 20, title: { display: true, text: 'Puntaje' } }
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
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
		</div>

		<!-- Course Evolution Chart - Full Width -->
		<div
			class="card bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl overflow-hidden"
		>
			<div class="card-body p-5">
				<div class="flex items-center justify-between mb-3">
					<div class="flex items-center gap-3">
						<div
							class="w-8 h-8 flex items-center justify-center rounded-lg bg-accent/15 text-accent"
						>
							<Activity class="h-5 w-5" />
						</div>
						<h3 class="text-lg font-medium">Evolución por Curso</h3>
					</div>
					{#if availableCourses.length > 0}
						<div class="flex items-center gap-2">
							<span class="text-sm text-base-content/70">Curso:</span>
							<select
								class="select select-sm select-bordered bg-base-100"
								bind:value={selectedCourseForEvolution}
							>
								<option value="">Seleccionar curso</option>
								{#each availableCourses as course (course.course_code)}
									<option value={course.course_name}>{course.course_name}</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>
				<div class="divider my-0"></div>
				{#if courseEvolutionData && courseEvolutionData.length > 0}
					<div class="h-80 relative mt-2">
						<canvas id="courseEvolutionChart"></canvas>
					</div>
				{:else}
					<div class="flex flex-col justify-center items-center h-80 text-base-content/70">
						<div class="text-4xl mb-4">📈</div>
						{#if !selectedCourseForEvolution}
							<p class="text-lg font-medium">Selecciona un curso</p>
							<p class="text-sm mt-2">Elige un curso del menú desplegable para ver su evolución</p>
						{:else}
							<p class="text-lg font-medium">No hay datos disponibles</p>
							<p class="text-sm mt-2">No se encontraron datos de evolución para este curso</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</main>

<!-- Student Search Modal Component -->
<StudentSearchModal
	open={studentSearchModalOpen}
	onClose={closeStudentSearchModal}
	onSelect={selectStudent}
/>
