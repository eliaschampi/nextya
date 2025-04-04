<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { Upload, Trash2, X, School, BookOpen } from 'lucide-svelte';
	import type { Eval, Level, EvalWithSections } from '../../../../app';
	import { formatDate } from '$lib/utils/formatDate';
	import { showToast } from '$lib/stores/Toast';
	import type { AnswerValue } from '$lib/omrProcessor';

	// Componentes personalizados
	import EvalDetails from '$lib/components/EvalDetails.svelte';
	import EvalHeader from '$lib/components/EvalHeader.svelte';
	import FileTable from '$lib/components/FileTable.svelte';
	import ImagePreview from '$lib/components/ImagePreview.svelte';
	import BatchProcessing from '$lib/components/BatchProcessing.svelte';

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

			// Enviar a la API para procesar
			const response = await fetch('/api/eval/omr', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					imageData,
					evalCode: selectedEval.code,
					selectionRect
				})
			});

			const result = await response.json();

			// Guardar el resultado
			processedResults[index] = result;

			// Mostrar notificación
			if (result.status === 'success') {
				showToast(
					`Procesado: ${file.name} - Estudiante: ${result.student?.name} ${result.student?.lastName} - Nota: ${result.results?.totalScore.toFixed(2)}`,
					'success'
				);
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

	async function loadEvalDetails() {
		if (!selectedEval) return;

		try {
			const formData = new FormData();
			formData.append('evalCode', selectedEval.code);

			const response = await fetch('?/getEvalDetails', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.success) {
				// Actualizar el selectedEval con la información completa
				selectedEval = result.eval;
				showToast('Detalles de evaluación cargados', 'success');
			} else {
				showToast(`Error: ${result.error}`, 'warning');
			}
		} catch (error) {
			console.error('Error loading eval details:', error);
			showToast('Error al cargar detalles de la evaluación', 'warning');
		}
	}

	function selectEval(evalItem: Eval) {
		// Asignar temporalmente como EvalWithSections para evitar error de tipo
		// Los detalles completos se cargarán con loadEvalDetails
		selectedEval = evalItem as unknown as EvalWithSections;
		evalModal?.close();
		showToast(`Evaluación "${evalItem.name}" seleccionada`, 'success');

		// Cargar detalles de la evaluación
		loadEvalDetails();
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

	<!-- Barra de herramientas -->
	<section class="card bg-base-200/80 shadow">
		<div class="card-body p-4">
			<div class="flex flex-wrap gap-2 justify-between items-center">
				<div class="flex gap-2">
					<label class="btn btn-primary">
						<Upload size={18} class="mr-2" /> Cargar Respuestas
						<input
							type="file"
							accept="image/jpeg,image/jpg"
							multiple
							class="hidden"
							onchange={handleFileUpload}
						/>
					</label>
					<button
						class="btn btn-error btn-outline"
						disabled={!uploadedFiles.length || isProcessing || isBatchProcessing}
						onclick={clearFiles}
					>
						<Trash2 size={18} /> Limpiar
					</button>
				</div>

				<div class="badge badge-lg">
					{uploadedFiles.length} archivos • {Object.values(processedResults).filter(
						(r) => r.status === 'success'
					).length} procesados
				</div>
			</div>
		</div>
	</section>

	<!-- Procesamiento por lotes -->
	{#if uploadedFiles.length > 0 && pendingFilesCount > 0}
		<BatchProcessing
			isProcessing={isBatchProcessing}
			pendingCount={pendingFilesCount}
			totalCount={uploadedFiles.length}
			onProcessAll={processAllFiles}
		/>
	{/if}

	<div class="flex flex-col lg:flex-row flex-1 gap-6">
		<!-- Panel de archivos -->
		<section class="w-full lg:w-1/3 card bg-base-200/80 shadow">
			<div class="card-body p-4">
				<header class="flex items-center justify-between mb-4">
					<h3 class="card-title">Archivos</h3>
					<div class="flex items-center gap-2">
						<span class="badge badge-primary badge-outline">{uploadedFiles.length}</span>
					</div>
				</header>

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
			</div>
		</section>

		<!-- Previsualización -->
		<section class="flex-1 card bg-base-200/80 shadow">
			<ImagePreview
				imageUrl={currentPreview}
				{selectionRect}
				status={previewStatus}
				fileIndex={selectedFileIndex}
				totalFiles={uploadedFiles.length}
				onchange={(rect) => (selectionRect = rect)}
			/>
		</section>
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
