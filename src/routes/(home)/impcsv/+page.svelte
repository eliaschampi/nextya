<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { Upload, FileText, Check, AlertCircle, Save } from 'lucide-svelte';
	import type { StudentRegisterData, OmittedRowDetail } from '$lib/csvProcessor';
	import { showToast } from '$lib/stores/Toast';
	import type { ToastType } from '$lib/types';
	import { permissionsStore } from '$lib/stores/permissions';

	// Props from server
	const { data } = $props<{
		data: {
			levels: { code: string; name: string }[];
		};
	}>();

	// UI state
	let loading = $state(false);
	let committing = $state(false);
	let showFileInput = $state(true);

	// Permissions
	const canSaveImport = permissionsStore.has({ entity: 'students', action: 'create' });

	// Data
	let file = $state<File | null>(null);
	let levelCode = $state('');
	let validRows = $state<StudentRegisterData[]>([]);
	let omittedRows = $state<OmittedRowDetail[]>([]);

	// Import summary
	let importSummary = $state<{
		totalProcessed: number;
		validCount: number;
		omittedCount: number;
		successRate: number;
	} | null>(null);

	// Commit results
	let commitResults = $state<{
		inserted: number;
		errors: { row: StudentRegisterData; error: string; code: string }[];
		duplicates: { row: StudentRegisterData; error: string; code: string }[];
		existingStudents: { row: StudentRegisterData; studentCode: string; studentName?: string }[];
		summary?: {
			totalProcessed: number;
			successRate: number;
		};
	} | null>(null);

	// Active tab for results
	let activeTab = $state('valid');

	// Handle file selection
	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			file = input.files[0];
		}
	}

	async function processFile() {
		if (!file || !levelCode) {
			showToast('Selecciona un archivo y un nivel', 'warning');
			return;
		}

		loading = true;
		// Reset state
		validRows = [];
		omittedRows = [];
		commitResults = null;

		try {
			// Create form data for file upload
			const formData = new FormData();
			formData.append('file', file);
			formData.append('level_code', levelCode);

			// Send to API for processing
			const response = await fetch('/api/impcsv/import', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error.message);
			}

			// Update state with results
			validRows = result.data.validRows;
			omittedRows = result.data.omittedRows;
			importSummary = result.data.summary || null;
			showFileInput = false;

			// Show success message
			const successRate = result.data.summary?.successRate || 0;
			showToast(
				`Archivo procesado: ${validRows.length} registros válidos, ${omittedRows.length} omitidos (${successRate}% éxito)`,
				'success'
			);
		} catch (error) {
			// Handle errors
			const errorMessage = error instanceof Error ? error.message : 'Error al procesar el archivo';
			showToast(errorMessage, 'danger' as ToastType);
		} finally {
			loading = false;
		}
	}

	async function commitData() {
		if (validRows.length === 0) {
			showToast('No hay datos válidos para importar', 'warning');
			return;
		}

		committing = true;

		try {
			// Send data to API for database insertion
			const response = await fetch('/api/impcsv/commit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					validRows,
					level_code: levelCode
				})
			});

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error.message);
			}

			// Update state with results
			commitResults = result.data;
			showToast(`Importación completada: ${result.data.inserted} registros insertados`, 'success');
		} catch (error) {
			// Handle errors
			const errorMessage = error instanceof Error ? error.message : 'Error al guardar los datos';
			showToast(errorMessage, 'danger' as ToastType);
		} finally {
			committing = false;
		}
	}

	function resetForm() {
		// Reset all state variables to initial values
		file = null;
		validRows = [];
		omittedRows = [];
		importSummary = null;
		commitResults = null;
		activeTab = 'valid';
		showFileInput = true;
	}

	// Derived state for level name - more efficient than calling a function repeatedly
	const levelName = $derived(
		data.levels.find((level: { code: string; name: string }) => level.code === levelCode)?.name ||
			levelCode ||
			''
	);
</script>

<PageTitle
	title="Importación CSV"
	description="Importa estudiantes y matrículas desde un archivo CSV"
>
	<span></span>
</PageTitle>

<div class="container mx-auto px-4 py-6">
	{#if showFileInput}
		<div
			class="card bg-gradient-to-br from-base-200 to-base-100 shadow border border-base-300/30 rounded-xl mb-6"
		>
			<div class="card-body p-6">
				<h2 class="card-title mb-4 flex items-center">
					<FileText size={20} class="mr-2 text-primary" />
					Importar Estudiantes desde CSV
				</h2>
				<fieldset class="fieldset bg-base-200 border-base-300 rounded-box w-full border p-4">
					<label class="label" for="level-select"> Nivel </label>
					<select id="level-select" class="select select-bordered" bind:value={levelCode}>
						<option value="" disabled selected>Selecciona un nivel</option>
						{#each data.levels as level (level.code)}
							<option value={level.code}>{level.name}</option>
						{/each}
					</select>
					<label class="label mt-4" for="file-input"> Archivo CSV </label>
					<input
						type="file"
						id="file-input"
						accept=".csv,.txt"
						class="file-input file-input-bordered w-full"
						onchange={handleFileChange}
					/>
					<div class="text-xs text-info mt-2">
						El archivo debe tener las columnas: name, last_name, phone, email, group_name, roll_code
					</div>
				</fieldset>

				<div class="form-control mb-6"></div>

				<div class="card-actions justify-end">
					<button
						class="btn btn-primary"
						onclick={processFile}
						disabled={loading || !file || !levelCode || !$canSaveImport}
					>
						{#if loading}
							<span class="loading loading-spinner loading-sm mr-2"></span>
							Procesando...
						{:else}
							<Upload size={16} class="mr-2" />
							Procesar Archivo
						{/if}
					</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex justify-between mb-4">
			<div>
				<h3 class="text-lg font-medium">
					Archivo: <span class="font-bold">{file?.name}</span>
				</h3>
				<p class="text-sm opacity-70">
					Nivel: <span class="font-medium">{levelName}</span>
				</p>
			</div>
			<div class="flex gap-2">
				<button
					class="btn btn-primary"
					onclick={commitData}
					disabled={committing ||
						validRows.length === 0 ||
						commitResults !== null ||
						!$canSaveImport}
				>
					{#if committing}
						<span class="loading loading-spinner loading-sm mr-2"></span>
						Guardando...
					{:else}
						<Save size={16} class="mr-2" />
						Guardar Datos
					{/if}
				</button>
				<button class="btn btn-outline" onclick={resetForm}>
					<Upload size={16} class="mr-2" />
					Nuevo Archivo
				</button>
			</div>
		</div>

		{#if importSummary}
			<div
				class="card bg-gradient-to-br from-base-200 to-base-100 shadow border border-base-300/30 rounded-xl mb-6"
			>
				<div class="card-body p-4">
					<h3 class="card-title mb-2">
						<FileText size={20} class="mr-2 text-primary" />
						Resumen de Procesamiento
					</h3>
					<div class="stats stats-vertical lg:stats-horizontal shadow w-full">
						<div class="stat">
							<div class="stat-title">Total Procesados</div>
							<div class="stat-value">{importSummary.totalProcessed}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Válidos</div>
							<div class="stat-value text-success">{importSummary.validCount}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Omitidos</div>
							<div class="stat-value text-warning">{importSummary.omittedCount}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Tasa de Éxito</div>
							<div class="stat-value text-info">{importSummary.successRate}%</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if commitResults}
			<div
				class="card bg-gradient-to-br from-base-200 to-base-100 shadow border border-base-300/30 rounded-xl mb-6"
			>
				<div class="card-body p-6">
					<h3 class="card-title text-success mb-2">
						<Check size={20} class="mr-2" />
						Importación Completada
					</h3>

					<!-- Results Summary -->
					<div class="stats stats-vertical lg:stats-horizontal shadow w-full">
						<div class="stat">
							<div class="stat-title">Registros Insertados</div>
							<div class="stat-value text-success">{commitResults.inserted}</div>
							{#if commitResults.summary}
								<div class="stat-desc">
									{commitResults.summary.successRate}% de éxito
								</div>
							{/if}
						</div>
						<div class="stat">
							<div class="stat-title">Problemas</div>
							<div class="stat-value text-warning">
								{commitResults.errors.length + commitResults.duplicates.length}
							</div>
						</div>
					</div>

					<!-- Results Details -->
					{#if commitResults.errors.length > 0 || commitResults.duplicates.length > 0}
						<div class="alert alert-warning mt-4">
							<div>
								<AlertCircle size={20} class="mr-2" />
								<span>
									Se encontraron {commitResults.errors.length + commitResults.duplicates.length} problemas
									durante la importación.
									{#if commitResults.errors.length > 0}
										{commitResults.errors.length} errores.
									{/if}
									{#if commitResults.duplicates.length > 0}
										{commitResults.duplicates.length} duplicados.
									{/if}
								</span>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Consolidated Data Table -->
		<div
			class="card bg-gradient-to-br from-base-200 to-base-100 shadow border border-base-300/30 rounded-xl"
		>
			<div class="card-body p-4">
				<div class="tabs tabs-boxed mb-4">
					<button
						class="tab {activeTab === 'valid' ? 'tab-active' : ''}"
						onclick={() => (activeTab = 'valid')}
					>
						<Check size={16} class="mr-1 text-success" />
						Válidos ({validRows.length})
					</button>
					<button
						class="tab {activeTab === 'omitted' ? 'tab-active' : ''}"
						onclick={() => (activeTab = 'omitted')}
					>
						<AlertCircle size={16} class="mr-1 text-warning" />
						Omitidos ({omittedRows.length})
					</button>
				</div>

				<div class="overflow-x-auto max-h-96">
					{#if activeTab === 'valid'}
						<table class="table table-zebra table-sm w-full">
							<thead>
								<tr>
									<th>Nombre</th>
									<th>Apellidos</th>
									<th>Código</th>
									<th>Grupo</th>
									<th>Email</th>
								</tr>
							</thead>
							<tbody>
								{#each validRows as row, i (i)}
									<tr>
										<td>{row.name}</td>
										<td>{row.last_name}</td>
										<td class="font-mono">{row.roll_code}</td>
										<td>{row.group_name}</td>
										<td class="text-xs">{row.email || '-'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else if activeTab === 'omitted'}
						<table class="table table-zebra table-sm w-full">
							<thead>
								<tr>
									<th>Fila</th>
									<th>Nombre</th>
									<th>Apellidos</th>
									<th>Código</th>
									<th>Razón</th>
								</tr>
							</thead>
							<tbody>
								{#each omittedRows as omitted, i (i)}
									<tr>
										<td class="font-mono">{omitted.rowNumber}</td>
										<td>{omitted.row.name || '-'}</td>
										<td>{omitted.row.last_name || '-'}</td>
										<td class="font-mono">{omitted.row.roll_code || '-'}</td>
										<td class="text-error text-xs">{omitted.reason}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
