<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { Upload, FileText, Check, AlertCircle, Save } from 'lucide-svelte';
	import type { StudentRegisterData, OmittedRowDetail } from '$lib/csvProcessor';
	import { showToast } from '$lib/stores/Toast';
	import type { ToastType } from '$lib/types';

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

	// Commit results
	let commitResults = $state<{
		inserted: number;
		errors: { row: StudentRegisterData; error: string }[];
		duplicates: { row: StudentRegisterData; error: string }[];
	} | null>(null);

	// Handle file selection
	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			file = input.files[0];
		}
	}

	// Process the CSV file
	async function processFile() {
		if (!file || !levelCode) {
			showToast('Selecciona un archivo y un nivel', 'warning');
			return;
		}

		loading = true;
		validRows = [];
		omittedRows = [];
		commitResults = null;

		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('level_code', levelCode);

			const response = await fetch('/api/impcsv/import', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!result.success) {
				throw new Error(result.error.message);
			}

			validRows = result.data.validRows;
			omittedRows = result.data.omittedRows;
			showFileInput = false;

			showToast(
				`Archivo procesado: ${validRows.length} registros válidos, ${omittedRows.length} omitidos`,
				'success'
			);
		} catch (error) {
			console.error('Error processing file:', error);
			showToast(
				error instanceof Error ? error.message : 'Error al procesar el archivo',
				'danger' as ToastType
			);
		} finally {
			loading = false;
		}
	}

	// Commit the validated data to the database
	async function commitData() {
		if (validRows.length === 0) {
			showToast('No hay datos válidos para importar', 'warning');
			return;
		}

		committing = true;

		try {
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

			commitResults = result.data;
			showToast(`Importación completada: ${result.data.inserted} registros insertados`, 'success');
		} catch (error) {
			console.error('Error committing data:', error);
			showToast(
				error instanceof Error ? error.message : 'Error al guardar los datos',
				'danger' as ToastType
			);
		} finally {
			committing = false;
		}
	}

	// Reset the form
	function resetForm() {
		file = null;
		validRows = [];
		omittedRows = [];
		commitResults = null;
		showFileInput = true;
	}

	// Get level name by code
	function getLevelName(code: string): string {
		return (
			data.levels.find((level: { code: string; name: string }) => level.code === code)?.name || code
		);
	}
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
			class="card bg-gradient-to-br from-base-200 to-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-base-300/30 rounded-xl mb-6"
		>
			<div class="card-body p-6">
				<h2 class="card-title mb-4 flex items-center">
					<FileText size={20} class="mr-2 text-primary" />
					Importar Estudiantes desde CSV
				</h2>

				<div class="form-control mb-4">
					<label class="label" for="level-select">
						<span class="label-text">Nivel</span>
					</label>
					<select id="level-select" class="select select-bordered w-full" bind:value={levelCode}>
						<option value="" disabled selected>Selecciona un nivel</option>
						{#each data.levels as level (level.code)}
							<option value={level.code}>{level.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-control mb-6">
					<label class="label" for="file-input">
						<span class="label-text">Archivo CSV</span>
					</label>
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
				</div>

				<div class="card-actions justify-end">
					<button
						class="btn btn-primary"
						onclick={processFile}
						disabled={loading || !file || !levelCode}
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
					Nivel: <span class="font-medium">{getLevelName(levelCode)}</span>
				</p>
			</div>
			<div class="flex gap-2">
				<button
					class="btn btn-primary"
					onclick={commitData}
					disabled={committing || validRows.length === 0 || commitResults !== null}
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

		{#if commitResults}
			<div
				class="card bg-gradient-to-br from-base-200 to-base-100 shadow-lg border border-base-300/30 rounded-xl mb-6"
			>
				<div class="card-body p-6">
					<h3 class="card-title text-success mb-2">
						<Check size={20} class="mr-2" />
						Importación Completada
					</h3>
					<div class="stats stats-vertical lg:stats-horizontal shadow w-full">
						<div class="stat">
							<div class="stat-title">Registros Insertados</div>
							<div class="stat-value text-success">{commitResults.inserted}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Errores</div>
							<div class="stat-value text-error">{commitResults.errors.length}</div>
						</div>
						<div class="stat">
							<div class="stat-title">Duplicados</div>
							<div class="stat-value text-warning">{commitResults.duplicates.length}</div>
						</div>
					</div>

					{#if commitResults.errors.length > 0 || commitResults.duplicates.length > 0}
						<div class="mt-4">
							<div class="tabs tabs-boxed">
								{#if commitResults.errors.length > 0}
									<button class="tab tab-active">Errores ({commitResults.errors.length})</button>
								{/if}
								{#if commitResults.duplicates.length > 0}
									<button class="tab">Duplicados ({commitResults.duplicates.length})</button>
								{/if}
							</div>
							<div class="mt-2 max-h-64 overflow-y-auto">
								<table class="table table-zebra table-sm w-full">
									<thead>
										<tr>
											<th>Nombre</th>
											<th>Apellidos</th>
											<th>Código</th>
											<th>Grupo</th>
											<th>Error</th>
										</tr>
									</thead>
									<tbody>
										{#each commitResults.errors as item, i (i)}
											<tr>
												<td>{item.row.name}</td>
												<td>{item.row.last_name}</td>
												<td class="font-mono">{item.row.roll_code}</td>
												<td>{item.row.group_name}</td>
												<td class="text-error">{item.error}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Valid Rows Table -->
			<div
				class="card bg-gradient-to-br from-base-200 to-base-100 shadow-lg border border-base-300/30 rounded-xl"
			>
				<div class="card-body p-4">
					<h3 class="card-title text-success mb-2">
						<Check size={20} class="mr-2" />
						Registros Válidos ({validRows.length})
					</h3>
					<div class="overflow-x-auto max-h-96">
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
					</div>
				</div>
			</div>

			<!-- Omitted Rows Table -->
			<div
				class="card bg-gradient-to-br from-base-200 to-base-100 shadow-lg border border-base-300/30 rounded-xl"
			>
				<div class="card-body p-4">
					<h3 class="card-title text-error mb-2">
						<AlertCircle size={20} class="mr-2" />
						Registros Omitidos ({omittedRows.length})
					</h3>
					<div class="overflow-x-auto max-h-96">
						<table class="table table-zebra table-sm w-full">
							<thead>
								<tr>
									<th>Fila</th>
									<th>Datos</th>
									<th>Razón</th>
								</tr>
							</thead>
							<tbody>
								{#each omittedRows as omitted, i (i)}
									<tr>
										<td class="font-mono">{omitted.rowNumber}</td>
										<td class="text-xs">
											{omitted.row.name || '-'}
											{omitted.row.last_name || '-'}
											({omitted.row.roll_code || '-'})
										</td>
										<td class="text-error text-xs">{omitted.reason}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
