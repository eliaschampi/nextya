<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart } from 'chart.js/auto';
	import {
		Users,
		BookOpen,
		School,
		FileText,
		Activity,
		FileSpreadsheet,
		UserRound,
		ChartBar
	} from 'lucide-svelte';
	import { showToast } from '$lib/stores/Toast';

	// State
	let isLoading = $state(true);
	let isChartLoading = $state(true);
	let counts = $state<{
		students: number;
		evals: number;
		levels: number;
		courses: number;
	}>({
		students: 0,
		evals: 0,
		levels: 0,
		courses: 0
	});
	let registersByLevel = $state<{ name: string; count: number }[]>([]);
	let registersByLevelChart: Chart | null = $state(null);

	// Derived state to track when to render charts
	let shouldRenderChart = $derived(registersByLevel.length > 0 && !isChartLoading);

	// Chart colors
	const chartColors = [
		'rgba(100, 220, 150, 0.8)',
		'rgba(54, 162, 235, 0.8)',
		'rgba(255, 206, 86, 0.8)',
		'rgba(255, 99, 132, 0.8)',
		'rgba(153, 102, 255, 0.8)',
		'rgba(255, 159, 64, 0.8)'
	];

	// Effect to render chart when data is available
	$effect(() => {
		if (shouldRenderChart) {
			// Small delay to ensure DOM is ready
			setTimeout(() => {
				renderRegistersByLevelChart();
			}, 200);
		}
	});

	// Load data on mount
	onMount(() => {
		const loadData = async () => {
			try {
				// Load counts and registers by level in parallel
				const [countsResponse, registersByLevelResponse] = await Promise.all([
					fetch('/api/dashboard/counts'),
					fetch('/api/dashboard/registers-by-level')
				]);

				if (!countsResponse.ok) {
					throw new Error('Error al cargar datos de conteos');
				}

				if (!registersByLevelResponse.ok) {
					throw new Error('Error al cargar datos de registros por nivel');
				}

				// Parse responses
				const countsData = await countsResponse.json();
				const registersByLevelData = await registersByLevelResponse.json();

				// Validate data
				if (typeof countsData === 'object' && countsData !== null) {
					counts = countsData;
				} else {
					showToast('Formato de datos de conteos inválido', 'danger');
				}

				if (Array.isArray(registersByLevelData)) {
					registersByLevel = registersByLevelData;
				} else {
					showToast('Formato de datos de registros por nivel inválido', 'danger');
				}
			} catch {
				showToast('Error al cargar datos del dashboard', 'danger');
			} finally {
				isLoading = false;
				isChartLoading = false;
			}
		};

		// Start loading data
		loadData();

		// Clean up chart on unmount
		return () => {
			if (registersByLevelChart) {
				registersByLevelChart.destroy();
			}
		};
	});

	// Render registers by level chart
	function renderRegistersByLevelChart() {
		if (!registersByLevel || !Array.isArray(registersByLevel) || registersByLevel.length === 0) {
			return;
		}

		// Get canvas element
		const canvasElement = document.getElementById('registersByLevelChart');
		if (!canvasElement) {
			return;
		}

		const ctx = canvasElement as HTMLCanvasElement;

		// Destroy existing chart if it exists
		if (registersByLevelChart) {
			registersByLevelChart.destroy();
			registersByLevelChart = null;
		}

		try {
			// Prepare data for chart
			const labels = registersByLevel.map((item) => item.name);
			const data = registersByLevel.map((item) => item.count);

			// Create new chart
			registersByLevelChart = new Chart(ctx, {
				type: 'bar',
				data: {
					labels: labels,
					datasets: [
						{
							label: 'Estudiantes Matriculados',
							data: data,
							backgroundColor: chartColors.slice(0, labels.length),
							borderColor: chartColors
								.map((color) => color.replace('0.8', '1'))
								.slice(0, labels.length),
							borderWidth: 1
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
									return `Estudiantes: ${value}`;
								}
							}
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							title: {
								display: true,
								text: 'Número de Estudiantes'
							}
						},
						x: {
							title: {
								display: true,
								text: 'Niveles'
							}
						}
					}
				}
			});

			console.log('Chart rendered successfully');
		} catch (error) {
			console.error('Error rendering chart:', error);
		}
	}
</script>

<!-- Stats Cards -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
	<!-- Students Count -->
	<a
		href="/student"
		class="card bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg border border-primary/30 rounded-xl overflow-hidden cursor-pointer"
	>
		<div class="card-body p-6">
			<div class="flex items-center justify-between">
				<h2 class="card-title text-xl font-semibold">Estudiantes</h2>
				<div class="p-3 rounded-full bg-primary/20 text-primary">
					<Users size={24} />
				</div>
			</div>
			{#if isLoading}
				<div class="flex justify-center py-2">
					<span class="loading loading-spinner loading-md text-primary"></span>
				</div>
			{:else}
				<p class="text-4xl font-bold mt-2">{counts.students.toLocaleString()}</p>
			{/if}
			<p class="text-sm opacity-70 mt-1">Total de estudiantes registrados</p>
		</div>
	</a>

	<!-- Evaluations Count -->
	<a
		href="/eval"
		class="card bg-gradient-to-br from-secondary/20 to-secondary/5 shadow-lg border border-secondary/30 rounded-xl overflow-hidden cursor-pointer"
	>
		<div class="card-body p-6">
			<div class="flex items-center justify-between">
				<h2 class="card-title text-xl font-semibold">Exámenes</h2>
				<div class="p-3 rounded-full bg-secondary/20 text-secondary">
					<FileText size={24} />
				</div>
			</div>
			{#if isLoading}
				<div class="flex justify-center py-2">
					<span class="loading loading-spinner loading-md text-secondary"></span>
				</div>
			{:else}
				<p class="text-4xl font-bold mt-2">{counts.evals.toLocaleString()}</p>
			{/if}
			<p class="text-sm opacity-70 mt-1">Evaluaciones creadas</p>
		</div>
	</a>

	<!-- Levels Count -->
	<a
		href="/levels"
		class="card bg-gradient-to-br from-accent/20 to-accent/5 shadow-lg border border-accent/30 rounded-xl overflow-hidden cursor-pointer"
	>
		<div class="card-body p-6">
			<div class="flex items-center justify-between">
				<h2 class="card-title text-xl font-semibold">Niveles</h2>
				<div class="p-3 rounded-full bg-accent/20 text-accent">
					<School size={24} />
				</div>
			</div>
			{#if isLoading}
				<div class="flex justify-center py-2">
					<span class="loading loading-spinner loading-md text-accent"></span>
				</div>
			{:else}
				<p class="text-4xl font-bold mt-2">{counts.levels.toLocaleString()}</p>
			{/if}
			<p class="text-sm opacity-70 mt-1">Niveles académicos</p>
		</div>
	</a>

	<!-- Courses Count -->
	<a
		href="/courses"
		class="card bg-gradient-to-br from-info/20 to-info/5 shadow-lg border border-info/30 rounded-xl overflow-hidden cursor-pointer"
	>
		<div class="card-body p-6">
			<div class="flex items-center justify-between">
				<h2 class="card-title text-xl font-semibold">Cursos</h2>
				<div class="p-3 rounded-full bg-info/20 text-info">
					<BookOpen size={24} />
				</div>
			</div>
			{#if isLoading}
				<div class="flex justify-center py-2">
					<span class="loading loading-spinner loading-md text-info"></span>
				</div>
			{:else}
				<p class="text-4xl font-bold mt-2">{counts.courses.toLocaleString()}</p>
			{/if}
			<p class="text-sm opacity-70 mt-1">Materias disponibles</p>
		</div>
	</a>
</div>

<!-- Chart Section -->
<div
	class="card bg-gradient-to-br from-base-200 to-base-100 shadow-lg border border-base-300/30 rounded-xl overflow-hidden mb-8"
>
	<div class="card-body p-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="card-title text-xl font-semibold">Estudiantes por Nivel</h2>
			{#if !isChartLoading && registersByLevel.length > 0}
				<div class="badge badge-primary">{registersByLevel.length} niveles</div>
			{/if}
		</div>

		{#if isChartLoading}
			<div class="flex justify-center items-center h-64">
				<div class="loading loading-spinner loading-lg text-primary"></div>
				<span class="ml-4 text-base-content/70">Cargando datos del gráfico...</span>
			</div>
		{:else if !registersByLevel || registersByLevel.length === 0}
			<div class="flex flex-col justify-center items-center h-64 text-base-content/70">
				<div class="text-4xl mb-4">📊</div>
				<p class="text-lg font-medium">No hay datos disponibles para mostrar</p>
				<p class="text-sm mt-2">No se encontraron registros de estudiantes por nivel</p>
			</div>
		{:else}
			<div class="h-80 relative" id="chartContainer">
				<canvas id="registersByLevelChart"></canvas>
			</div>
		{/if}
	</div>
</div>

<!-- Quick Access Cards -->
<h2 class="text-2xl font-semibold mb-4">Acceso Rápido</h2>
<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
	<!-- Dashboard -->
	<a
		href="/dashboard"
		class="card bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg border border-primary/20 rounded-xl overflow-hidden cursor-pointer"
	>
		<div class="card-body p-6">
			<div class="flex flex-col items-center text-center">
				<div class="p-4 rounded-full bg-primary/15 text-primary mb-4">
					<Activity size={32} />
				</div>
				<h2 class="card-title text-xl font-semibold">Dashboard</h2>
				<p class="text-sm opacity-70 mt-2">Visualiza estadísticas y rendimiento de estudiantes</p>
			</div>
		</div>
	</a>

	<a
		href="/course_dashboard"
		class="card bg-gradient-to-br from-secondary/10 to-secondary/5 shadow-lg border border-secondary/20 rounded-xl overflow-hidden cursor-pointer"
	>
		<div class="card-body p-6">
			<div class="flex flex-col items-center text-center">
				<div class="p-4 rounded-full bg-secondary/15 text-secondary mb-4">
					<ChartBar size={32} />
				</div>
				<h2 class="card-title text-xl font-semibold">Graficos</h2>
				<p class="text-sm opacity-70 mt-2">Estadísticas y análisis de rendimiento</p>
			</div>
		</div>
	</a>

	<!-- Profile -->
	<a
		href="/profile"
		class="card bg-gradient-to-br from-accent/10 to-accent/5 shadow-lg border border-accent/20 rounded-xl overflow-hidden cursor-pointer"
	>
		<div class="card-body p-6">
			<div class="flex flex-col items-center text-center">
				<div class="p-4 rounded-full bg-accent/15 text-accent mb-4">
					<UserRound size={32} />
				</div>
				<h2 class="card-title text-xl font-semibold">Mi Perfil</h2>
				<p class="text-sm opacity-70 mt-2">Gestiona tu información personal</p>
			</div>
		</div>
	</a>
</div>
