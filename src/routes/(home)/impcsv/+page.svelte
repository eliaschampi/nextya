<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Table from '$lib/components/Table.svelte';
	import { Upload, FileText, Check, AlertCircle, Save } from 'lucide-svelte';
	import type { StudentRegisterData, OmittedRowDetail } from '$lib/csvProcessor';
	import { showToast } from '$lib/stores/Toast';
	import type { ToastType } from '$lib/types';
	import type { TableColumn } from '$lib/types/table';

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

	// Define table columns for valid rows
	const validRowsColumns: TableColumn<StudentRegisterData>[] = [
		{ key: 'name', label: 'Nombre' },
		{ key: 'last_name', label: 'Apellidos' },
		{ key: 'roll_code', label: 'Código', class: 'font-mono' },
		{ key: 'group_name', label: 'Grupo' },
		{ label: 'Email', class: 'text-xs', render: emailCell }
	];

	// Define table columns for omitted rows
	const omittedRowsColumns: TableColumn<OmittedRowDetail>[] = [
		{ key: 'rowNumber', label: 'Fila', class: 'font-mono' },
		{ label: 'Nombre', render: nameCell },
		{ label: 'Apellidos', render: lastNameCell },
		{ label: 'Código', class: 'font-mono', render: rollCodeCell },
		{ key: 'reason', label: 'Razón', class: 'text-error text-xs' }
	];
</script>

<!-- Define snippets for custom cells -->
{#snippet emailCell(row: StudentRegisterData)}
	{row.email || '-'}
{/snippet}

{#snippet nameCell(row: OmittedRowDetail)}
	{row.row.name || '-'}
{/snippet}

{#snippet lastNameCell(row: OmittedRowDetail)}
	{row.row.last_name || '-'}
{/snippet}

{#snippet rollCodeCell(row: OmittedRowDetail)}
	{row.row.roll_code || '-'}
{/snippet}

<PageTitle
	title="Importación CSV"
	description="Importa estudiantes y matrículas desde un archivo CSV"
>
	<div></div>
</PageTitle>

<main class="flex flex-col h-full gap-6 p-4">
	{#if showFileInput}
		<div class="card bg-base-200/80 shadow overflow-hidden">
			<div class="card-body p-6">
				<h2 class="card-title text-primary mb-6">
					<FileText size={20} />
					Importar Estudiantes desde CSV
				</h2>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
					<div>
						<label for="level-select">
							<span class="label-text font-medium">Nivel</span>
						</label>
						<select id="level-select" class="select select-bordered w-full" bind:value={levelCode}>
							<option value="" disabled selected>Selecciona un nivel</option>
							{#each data.levels as level (level.code)}
								<option value={level.code}>{level.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="file-input">
							<span class="label-text font-medium">Archivo CSV</span>
						</label>
						<input
							type="file"
							id="file-input"
							accept=".csv,.txt"
							class="file-input file-input-bordered w-full"
							onchange={handleFileChange}
						/>
					</div>
				</div>

				<div class="text-xs text-info mb-6">
					Columnas requeridas: name, last_name, phone, email, group_name, roll_code. Separador por
					coma (,)
				</div>

				<div class="flex justify-end">
					<button
						class="btn btn-primary"
						onclick={processFile}
						disabled={loading || !file || !levelCode}
					>
						{#if loading}
							<span class="loading loading-spinner loading-sm"></span>
							Procesando...
						{:else}
							<Upload size={16} />
							Procesar Archivo
						{/if}
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- File Info Header -->
		<div class="card bg-base-200/80 shadow overflow-hidden">
			<div class="card-body p-4 border-b border-base-300/30">
				<div class="flex justify-between items-center">
					<div>
						<h3 class="text-lg font-semibold text-primary">
							{file?.name}
						</h3>
						<p class="text-sm text-base-content/70">
							Nivel: {levelName}
						</p>
					</div>
					<div class="flex gap-2">
						<button
							class="btn btn-primary"
							onclick={commitData}
							disabled={committing || validRows.length === 0 || commitResults !== null}
						>
							{#if committing}
								<span class="loading loading-spinner loading-sm"></span>
								Guardando...
							{:else}
								<Save size={16} />
								Guardar Datos
							{/if}
						</button>
						<button class="btn btn-outline" onclick={resetForm}>
							<Upload size={16} />
							Nuevo Archivo
						</button>
					</div>
				</div>
			</div>
		</div>

		{#if importSummary}
			<div class="card bg-base-200/80 shadow overflow-hidden">
				<div class="card-body p-4">
					<h3 class="card-title text-primary mb-4">
						<FileText size={20} />
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
			<div class="card bg-base-200/80 shadow overflow-hidden">
				<div class="card-body p-4">
					<h3 class="card-title text-success mb-4">
						<Check size={20} />
						Importación Completada
					</h3>

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

					{#if commitResults.errors.length > 0 || commitResults.duplicates.length > 0}
						<div class="alert alert-warning mt-4">
							<AlertCircle size={20} />
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
					{/if}
				</div>
			</div>
		{/if}

		<!-- Data Table -->
		<div class="card bg-base-200/80 shadow overflow-hidden">
			<div class="card-body p-4">
				<div class="tabs tabs-boxed mb-4">
					<button
						class="tab {activeTab === 'valid' ? 'tab-active' : ''}"
						onclick={() => (activeTab = 'valid')}
					>
						<Check size={16} class="text-success" />
						Válidos ({validRows.length})
					</button>
					<button
						class="tab {activeTab === 'omitted' ? 'tab-active' : ''}"
						onclick={() => (activeTab = 'omitted')}
					>
						<AlertCircle size={16} class="text-warning" />
						Omitidos ({omittedRows.length})
					</button>
				</div>

				<div class="overflow-x-auto max-h-96">
					{#if activeTab === 'valid'}
						<Table
							columns={validRowsColumns}
							rows={validRows}
							striped={true}
							hover={true}
							bordered={true}
							compact={true}
							emptyMessage="No hay registros válidos para mostrar."
						/>
					{:else if activeTab === 'omitted'}
						<Table
							columns={omittedRowsColumns}
							rows={omittedRows}
							striped={true}
							hover={true}
							bordered={true}
							compact={true}
							emptyMessage="No hay registros omitidos para mostrar."
						/>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</main>
