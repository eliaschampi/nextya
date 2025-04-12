<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { Upload, Trash2, X, School, BookOpen, Play, Loader2, Check } from 'lucide-svelte';
	import type { Eval, Level, EvalWithSections } from '../../../../app';
	import { formatDate } from '$lib/utils/formatDate';
	import { showToast } from '$lib/stores/Toast';
	import type { AnswerValue } from '$lib/omrProcessor';

	// Componentes personalizados
	import EvalDetails from '$lib/components/EvalDetails.svelte';
	import EvalHeader from '$lib/components/EvalHeader.svelte';
	import FileTable from '$lib/components/FileTable.svelte';
	import ImagePreview from '$lib/components/ImagePreview.svelte';
	// BatchProcessing functionality integrated directly

	// Props tipados
	const { data } = $props<{ data: { levels: Level[] } }>();

	// Estados reactivos con Svelte v5 runes
	let evalModal = $state<HTMLDialogElement | null>(null);
	let selectedEval = $state<EvalWithSections | null>(null);
	let uploadedFiles = $state<File[]>([]);
	let selectedFileIndex = $state(-1);
	let evaluations = $state<Eval[]>([]);

	let selectedLevel = $state('');
	let isProcessing = $state(false);
	let processingIndex = $state(-1);
	let processedResults = $state<Record<number, ProcessedResult>>({});
	let isBatchProcessing = $state(false);

	// Estado del rectángulo de selección en porcentajes (0-100)
	let selectionRect = $state({ top: 10, left: 10, width: 80, height: 80 });

	// Interfaces para los resultados procesados
	interface ProcessedResult {
		status: 'success' | 'error';
		studentCode?: string;
		student?: {
			name: string;
			lastName: string;
			rollCode: string;
		};
		results?: {
			correctCount: number;
			incorrectCount: number;
			blankCount: number;
			totalScore: number;
		};
		answers?: Record<number, AnswerValue>;
		message?: string;
	}

	// Previsualización derivada
	let currentPreview = $derived(
		selectedFileIndex >= 0 && selectedFileIndex < uploadedFiles.length
			? URL.createObjectURL(uploadedFiles[selectedFileIndex])
			: ''
	);

	// Valores derivados para el estado de procesamiento
	let pendingFilesCount = $derived(
		uploadedFiles.filter(
			(_, index) => !processedResults[index] || processedResults[index]?.status === 'error'
		).length
	);

	let previewStatus: 'pending' | 'processing' | 'success' | 'error' | undefined = $derived(
		isProcessing && processingIndex === selectedFileIndex
			? 'processing'
			: processedResults[selectedFileIndex]?.status === 'success'
				? 'success'
				: processedResults[selectedFileIndex]?.status === 'error'
					? 'error'
					: 'pending'
	);

	// Funciones principales
	async function loadEvaluationsByLevel() {
		if (!selectedLevel) return (evaluations = []);
		const response = await fetch(`/api/eval/${selectedLevel}`);
		evaluations = response.ok ? await response.json() : [];
	}

	function openEvalModal() {
		selectedLevel = '';
		evaluations = [];
		evalModal?.showModal();
	}

	function handleFileUpload(event: Event) {
		const files = (event.target as HTMLInputElement).files;
		if (!files) return;
		const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
		if (imageFiles.length < files.length) {
			showToast('Algunos archivos no son imágenes y fueron ignorados', 'warning');
		}
		uploadedFiles = [...uploadedFiles, ...imageFiles];
		selectedFileIndex = uploadedFiles.length - 1;
		showToast(`${imageFiles.length} imagen(es) cargada(s)`, 'success');
	}

	function clearFiles() {
		uploadedFiles.forEach((file) => URL.revokeObjectURL(URL.createObjectURL(file)));
		uploadedFiles = [];
		selectedFileIndex = -1;
		processedResults = {};
		showToast('Archivos eliminados', 'success');
	}

	function removeFile(index: number) {
		URL.revokeObjectURL(URL.createObjectURL(uploadedFiles[index]));
		uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
		selectedFileIndex = uploadedFiles.length
			? Math.min(selectedFileIndex, uploadedFiles.length - 1)
			: -1;

		// Actualizar processedResults
		const newProcessedResults: Record<number, ProcessedResult> = {};

		Object.entries(processedResults).forEach(([k, v]) => {
			const key = Number(k);
			if (key !== index) {
				const newKey = key > index ? key - 1 : key;
				newProcessedResults[newKey] = v;
			}
		});

		processedResults = newProcessedResults;
	}

	async function processFile(index: number) {
		if (!selectedEval || !uploadedFiles[index]) {
			showToast('No se puede procesar este archivo', 'warning');
			return;
		}

		try {
			// Marcar como procesando
			isProcessing = true;
			processingIndex = index;
			selectedFileIndex = index;

			const file = uploadedFiles[index];
			const reader = new FileReader();

			const imageData = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});

			// Enviar a la API para procesar con los datos de evaluación y preguntas
			const response = await fetch('/api/eval/omr', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					imageData,
					selectionRect,
					evalData: selectedEval
				})
			});

			const result = await response.json();

			// Guardar el resultado
			processedResults[index] = result;

			// Mostrar notificación
			if (result.status === 'success') {
				showToast(`Correctamennte procesado ${file.name}`, 'success');
			} else {
				showToast(`Error en ${file.name}: ${result.message}`, 'warning');
			}

			return result;
		} catch (error) {
			console.error('Error processing file:', error);
			showToast(`Error al procesar ${uploadedFiles[index].name}`, 'warning');

			// Guardar el error
			processedResults[index] = {
				status: 'error',
				message: error instanceof Error ? error.message : 'Error desconocido'
			};

			return null;
		} finally {
			isProcessing = false;
			processingIndex = -1;
		}
	}

	// Función para procesar todos los archivos pendientes
	async function processAllFiles() {
		if (!selectedEval || uploadedFiles.length === 0 || isBatchProcessing) return;

		try {
			isBatchProcessing = true;
			let totalPending = pendingFilesCount;
			let processed = 0;

			// Procesar archivos pendientes uno por uno
			for (let i = 0; i < uploadedFiles.length; i++) {
				// Saltar archivos ya procesados correctamente
				if (processedResults[i]?.status === 'success') continue;

				await processFile(i);
				processed++;

				// Actualizar progreso
				const progress = Math.round((processed / totalPending) * 100);
				showToast(`Procesando lote: ${progress}% completado`, 'success');
			}

			showToast('Procesamiento por lotes completado', 'success');
		} catch (error) {
			console.error('Error en procesamiento por lotes:', error);
			showToast('Error en procesamiento por lotes', 'warning');
		} finally {
			isBatchProcessing = false;
		}
	}

	function selectEval(evalItem: Eval) {
		selectedEval = evalItem as unknown as EvalWithSections;
		evalModal?.close();
	}

	// Limpiar URLs al desmontar
	$effect(() => () => currentPreview && URL.revokeObjectURL(currentPreview));
</script>

<PageTitle title="Proceso de verificacion" description="Procesa hojas de respuestas con OMR">
	<button
		class="w-full bg-base-200 hover:bg-base-300 transition-all duration-300 rounded-lg shadow-sm"
		onclick={openEvalModal}
		aria-label="Seleccionar evaluación"
	>
		<div class="flex items-center justify-center gap-2 p-5">
			<School size={20} />
			<span>Seleccionar evaluación</span>
		</div>
	</button>
</PageTitle>

<main class="flex flex-col h-full gap-6 p-4">
	<!-- Información de la evaluación seleccionada -->
	{#if selectedEval}
		<EvalHeader
			evaluation={selectedEval}
			level={data.levels.find((l: Level) => l.code === selectedEval?.level_code)}
		>
			<EvalDetails evaluation={selectedEval} />
		</EvalHeader>
	{/if}

	<!-- Contenedor principal unificado -->
	<div class="card bg-base-200/80 shadow overflow-hidden">
		<!-- Barra de herramientas y procesamiento por lotes unificados -->
		<div class="card-body p-4 border-b border-base-300/30">
			<div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
				<div class="flex flex-wrap gap-2 items-center">
					<div class="join">
						<label
							class="btn join-item btn-primary btn-sm {!selectedEval?.code ? 'btn-disabled' : ''}"
						>
							<Upload size={16} class="mr-2" /> Cargar
							<input
								type="file"
								accept="image/jpeg,image/jpg"
								multiple
								class="hidden"
								onchange={handleFileUpload}
								disabled={!selectedEval?.code}
							/>
						</label>
						<button
							class="btn join-item btn-error btn-outline btn-sm"
							disabled={!uploadedFiles.length || isProcessing || isBatchProcessing}
							onclick={clearFiles}
						>
							<Trash2 size={16} />
						</button>
					</div>

					{#if uploadedFiles.length > 0 && pendingFilesCount > 0}
						<button
							class="btn btn-primary btn-sm {isBatchProcessing ? 'btn-disabled' : ''}"
							onclick={processAllFiles}
							disabled={isBatchProcessing || pendingFilesCount === 0 || !selectedEval}
						>
							{#if isBatchProcessing}
								<Loader2 class="animate-spin mr-1" size={16} />
								Procesando...
							{:else}
								<Play size={16} class="mr-1" />
								Procesar todos ({pendingFilesCount})
							{/if}
						</button>
					{/if}
				</div>

				<div
					class="flex items-center gap-2 bg-base-100/50 px-3 py-1.5 rounded-lg border border-base-300/30"
				>
					<div class="flex items-center gap-1.5">
						<span class="badge badge-primary badge-sm">{uploadedFiles.length}</span>
						<span class="text-sm">archivos</span>
					</div>
					<div class="w-0.5 h-4 bg-base-300/50"></div>
					<div class="flex items-center gap-1.5">
						<span class="badge badge-success badge-sm"
							>{Object.values(processedResults).filter((r) => r.status === 'success').length}</span
						>
						<span class="text-sm">procesados</span>
					</div>
				</div>
			</div>

			<!-- Barra de progreso para procesamiento por lotes -->
			{#if isBatchProcessing}
				<div class="mt-2">
					<div class="w-full bg-base-300 rounded-full h-1.5 mb-1">
						<div
							class="bg-primary h-1.5 rounded-full transition-all duration-300"
							style="width: {((uploadedFiles.length - pendingFilesCount) / uploadedFiles.length) *
								100}%"
						></div>
					</div>
					<div class="text-xs text-right">
						{uploadedFiles.length - pendingFilesCount} de {uploadedFiles.length} ({Math.round(
							((uploadedFiles.length - pendingFilesCount) / uploadedFiles.length) * 100
						)}%)
					</div>
				</div>
			{:else if uploadedFiles.length > 0 && pendingFilesCount === 0}
				<div class="alert alert-success py-2 px-4 mt-2">
					<Check class="w-5 h-5" />
					<span>Todos los archivos han sido procesados.</span>
				</div>
			{/if}
		</div>

		<!-- Contenido principal: archivos y previsualización -->
		<div
			class="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-base-300/30"
		>
			<!-- Panel de archivos -->
			<div class="lg:col-span-1 p-4">
				<header class="flex items-center justify-between mb-4">
					<h3 class="font-bold text-lg">Archivos</h3>
					<div class="flex items-center gap-2">
						<span class="badge badge-primary badge-outline">{uploadedFiles.length}</span>
					</div>
				</header>

				{#if uploadedFiles.length > 0}
					<FileTable
						files={uploadedFiles}
						{processedResults}
						selectedIndex={selectedFileIndex}
						{isProcessing}
						{processingIndex}
						evalSelected={!!selectedEval}
						onSelect={(index) => (selectedFileIndex = index)}
						onProcess={processFile}
						onRemove={removeFile}
					/>
				{:else}
					<div
						class="flex flex-col items-center justify-center p-8 text-center bg-base-100/50 rounded-lg border border-base-300/30"
					>
						<Upload size={48} class="text-primary/50 mb-4" />
						<p class="text-base-content/70 mb-2">No hay archivos cargados</p>
						<p class="text-sm text-base-content/50 mb-4">
							Carga imágenes de hojas de respuestas para procesar
						</p>
						<label class="btn btn-primary btn-sm {!selectedEval?.code ? 'btn-disabled' : ''}">
							<Upload size={16} class="mr-2" /> Cargar Imágenes
							<input
								type="file"
								accept="image/jpeg,image/jpg"
								multiple
								class="hidden"
								onchange={handleFileUpload}
								disabled={!selectedEval?.code}
							/>
						</label>
					</div>
				{/if}
			</div>

			<!-- Previsualización -->
			<div class="lg:col-span-2">
				{#if uploadedFiles.length > 0}
					<ImagePreview
						imageUrl={currentPreview}
						{selectionRect}
						status={previewStatus}
						fileIndex={selectedFileIndex}
						totalFiles={uploadedFiles.length}
						onchange={(rect) => (selectionRect = rect)}
					/>
				{:else}
					<div class="card-body flex flex-col items-center justify-center p-8 text-center">
						<div class="bg-base-100/50 rounded-lg border border-base-300/30 p-8 w-full max-w-md">
							<School size={64} class="text-primary/30 mx-auto mb-4" />
							<h3 class="text-lg font-bold mb-2">Listo para procesar</h3>
							<p class="text-base-content/70 mb-4">
								Carga imágenes de hojas de respuestas para comenzar
							</p>

							{#if !selectedEval}
								<button class="btn btn-primary btn-sm" onclick={openEvalModal}>
									<School size={16} class="mr-2" /> Seleccionar evaluación
								</button>
							{:else}
								<label class="btn btn-primary btn-sm">
									<Upload size={16} class="mr-2" /> Cargar Imágenes
									<input
										type="file"
										accept="image/jpeg,image/jpg"
										multiple
										class="hidden"
										onchange={handleFileUpload}
									/>
								</label>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

<!-- Modal de selección de evaluación -->
<dialog bind:this={evalModal} class="modal">
	<div class="modal-box max-w-2xl">
		<header class="flex items-center justify-between mb-6">
			<h3 class="text-lg font-bold flex gap-2">
				<School class="w-6 h-6 text-primary" /> Seleccionar Evaluación
			</h3>
			<button class="btn btn-circle btn-ghost" onclick={() => evalModal?.close()}>
				<X size={20} />
			</button>
		</header>
		<div class="bg-base-100 rounded-xl p-4 mb-6 shadow-sm">
			<label class="label font-semibold flex gap-2">
				<BookOpen class="w-5 h-5 text-primary" /> Nivel
			</label>
			<select
				class="select select-bordered w-full"
				bind:value={selectedLevel}
				onchange={loadEvaluationsByLevel}
			>
				<option value="">Elige un nivel</option>
				{#each data.levels as level (level.code)}
					<option value={level.code}>{level.name}</option>
				{/each}
			</select>
		</div>
		<div class="overflow-x-auto rounded-lg bg-base-200 shadow-sm">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th>Nombre</th>
						<th class="text-center">Grupo</th>
						<th class="text-center">Fecha</th>
						<th class="text-center">Acción</th>
					</tr>
				</thead>
				<tbody>
					{#each evaluations as item (item.code)}
						<tr class="hover:bg-base-300">
							<td class="font-medium">{item.name}</td>
							<td class="text-center"><span class="badge badge-ghost">{item.group_name}</span></td>
							<td class="text-center text-sm opacity-70">{formatDate(item.eval_date)}</td>
							<td class="text-center">
								<button class="btn btn-primary btn-sm" onclick={() => selectEval(item)}>
									Seleccionar
								</button>
							</td>
						</tr>
					{:else}
						<tr><td colspan="4" class="text-center py-8 opacity-50">Sin evaluaciones</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
