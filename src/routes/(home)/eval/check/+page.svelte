<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { Upload, Trash2, X, School, BookOpen, Play, Loader2, Plus, Save } from 'lucide-svelte';
	import type { Eval, Level, EvalWithSections, EvalQuestion } from '../../../../app';
	import { formatDate } from '$lib/utils/formatDate';
	import { showToast } from '$lib/stores/Toast';
	import { base64ToFile } from '$lib/utils/imageUtils';
	import { goto } from '$app/navigation';

	// Componentes personalizados
	import EvalDetails from '$lib/components/EvalDetails.svelte';
	import EvalHeader from '$lib/components/EvalHeader.svelte';
	import FileTable from '$lib/components/FileTable.svelte';
	import ImagePreview from '$lib/components/ImagePreview.svelte';
	import Message from '$lib/components/Message.svelte';
	import OmrDetailsModal from '$lib/components/OmrDetailsModal.svelte';
	import type { OmrProcessedResult } from '$lib/types/omrProcessing';

	// Props tipados
	const { data } = $props<{
		data: { levels: Level[]; questions: EvalQuestion[]; evalCode?: string };
	}>();

	// Estado para almacenar las preguntas de la evaluación seleccionada
	let evalQuestions = $state<EvalQuestion[]>(data.questions || []);

	// Estados reactivos con Svelte v5 runes
	let evalModal = $state<HTMLDialogElement | null>(null);
	let selectedEval = $state<EvalWithSections | null>(null);
	let uploadedFiles = $state<File[]>([]);
	let selectedFileIndex = $state(-1);
	let evaluations = $state<Eval[]>([]);

	let selectedLevel = $state('');
	let isProcessing = $state(false);
	let processingIndex = $state(-1);
	let processedResults = $state<Record<number, OmrProcessedResult>>({});
	let isBatchProcessing = $state(false);
	let isSaving = $state(false);
	let savingIndex = $state(-1);
	let showDetailsModal = $state(false);
	let selectedResultForDetails = $state<OmrProcessedResult | null>(null);

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

	// Función para manejar la imagen procesada (rotada o recortada)
	function handleProcessedImage(processedImageData: string) {
		if (!uploadedFiles[selectedFileIndex]) return;

		// Revocar la URL anterior
		URL.revokeObjectURL(URL.createObjectURL(uploadedFiles[selectedFileIndex]));

		// Convertir la imagen base64 a un archivo usando la utilidad
		const fileName = uploadedFiles[selectedFileIndex].name;
		const newFile = base64ToFile(processedImageData, fileName);

		// Reemplazar el archivo en el array
		const newFiles = [...uploadedFiles];
		newFiles[selectedFileIndex] = newFile;
		uploadedFiles = newFiles;

		// Actualizar la vista previa
		showToast('Imagen procesada correctamente', 'success');
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
		const newProcessedResults: Record<number, OmrProcessedResult> = {};

		Object.entries(processedResults).forEach(([k, v]) => {
			const key = Number(k);
			if (key !== index) {
				const newKey = key > index ? key - 1 : key;
				newProcessedResults[newKey] = v;
			}
		});

		processedResults = newProcessedResults;
	}

	async function processFile(index: number, rollCode: string | null = null) {
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
					evalData: selectedEval,
					rollCode, // Pasar el código si se proporciona
					questions: evalQuestions // Pasar las preguntas para evitar consultas redundantes
				})
			});

			const result = await response.json();

			// Guardar el resultado
			processedResults[index] = result;

			// Mostrar notificación solo si no estamos en procesamiento por lotes
			if (!isBatchProcessing) {
				if (result.status === 'success') {
					if (result.student) {
						showToast(`Procesado: ${result.student.name} ${result.student.lastName}`, 'success');
					} else {
						showToast(`Procesado pero estudiante no encontrado: ${result.studentCode}`, 'warning');
					}
				} else {
					showToast(`Error en ${file.name}: ${result.message}`, 'warning');
				}
			}

			return result;
		} catch (error) {
			console.error('Error processing file:', error);

			// Mostrar notificación solo si no estamos en procesamiento por lotes
			if (!isBatchProcessing) {
				showToast(`Error al procesar ${uploadedFiles[index].name}`, 'warning');
			}

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

			// Procesar archivos pendientes uno por uno
			for (let i = 0; i < uploadedFiles.length; i++) {
				// Saltar archivos ya procesados correctamente
				if (processedResults[i]?.status === 'success') continue;

				await processFile(i);

				// No mostrar toast por cada archivo procesado en modo lote
				// Solo actualizar la barra de progreso visual
			}

			showToast('Procesamiento por lotes completado', 'success');
		} catch (error) {
			console.error('Error en procesamiento por lotes:', error);
			showToast('Error en procesamiento por lotes', 'warning');
		} finally {
			isBatchProcessing = false;
		}
	}

	// Función para guardar un resultado individual
	async function saveResult(index: number) {
		if (!selectedEval || !processedResults[index] || !processedResults[index].student) {
			showToast('No se puede guardar este resultado', 'warning');
			return;
		}

		try {
			isSaving = true;
			savingIndex = index;

			const result = processedResults[index];
			const registerCode = result.student?.registerCode;

			if (!registerCode) {
				showToast('Código de registro no encontrado', 'warning');
				return;
			}

			// Preparar datos para guardar
			const saveData = {
				evalCode: selectedEval.code,
				registerCode,
				answers: result.answers || {},
				correctCount: result.results?.correctCount || 0,
				incorrectCount: result.results?.incorrectCount || 0,
				blankCount: result.results?.blankCount || 0,
				totalScore: result.results?.totalScore || 0,
				questions: evalQuestions // Pasar las preguntas para evitar consultas redundantes
			};

			// Enviar a la API para guardar
			const response = await fetch('/api/eval/save-results', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(saveData)
			});

			const saveResult = await response.json();

			if (saveResult.status === 'success') {
				showToast(
					`Resultados guardados para ${result.student?.name || ''} ${result.student?.lastName || ''}`,
					'success'
				);

				// Marcar como guardado en el resultado
				processedResults[index] = {
					...result,
					saved: true
				};
			} else {
				showToast(`Error al guardar: ${saveResult.message}`, 'warning');
			}

			return saveResult;
		} catch (error) {
			console.error('Error saving result:', error);
			showToast('Error al guardar resultados', 'warning');
			return null;
		} finally {
			isSaving = false;
			savingIndex = -1;
		}
	}

	// Función para guardar todos los resultados en lote
	async function saveAllResults() {
		if (!selectedEval) {
			showToast('No hay evaluación seleccionada', 'warning');
			return;
		}

		// Filtrar solo los resultados válidos con estudiante
		const validResults = Object.entries(processedResults)
			.filter(([, result]) => result.status === 'success' && result.student && !result.saved)
			.map(([, result]) => ({
				registerCode: result.student?.registerCode || '',
				answers: result.answers || {},
				correctCount: result.results?.correctCount || 0,
				incorrectCount: result.results?.incorrectCount || 0,
				blankCount: result.results?.blankCount || 0,
				totalScore: result.results?.totalScore || 0
			}));

		if (validResults.length === 0) {
			showToast('No hay resultados válidos para guardar', 'warning');
			return;
		}

		try {
			isSaving = true;

			// Preparar datos para guardar en lote
			const batchData = {
				evalCode: selectedEval.code,
				results: validResults,
				questions: evalQuestions // Pasar las preguntas para evitar consultas redundantes
			};

			// Enviar a la API para guardar en lote
			const response = await fetch('/api/eval/save-batch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(batchData)
			});

			const batchResult = await response.json();

			if (batchResult.status === 'success') {
				showToast(
					`${batchResult.processedResults?.length || 0} resultados guardados correctamente`,
					'success'
				);

				// Marcar como guardados los resultados exitosos
				if (batchResult.processedResults) {
					Object.entries(processedResults).forEach(([index, result]) => {
						if (
							result.student &&
							batchResult.processedResults.some(
								(pr: { registerCode: string; status: string }) =>
									pr.registerCode === result.student?.registerCode && pr.status === 'success'
							)
						) {
							processedResults[Number(index)] = {
								...result,
								saved: true
							};
						}
					});
				}

				// Mostrar errores si hay
				if (batchResult.errors && batchResult.errors.length > 0) {
					showToast(`${batchResult.errors.length} resultados con error`, 'warning');
				}
			} else {
				showToast(`Error al guardar en lote: ${batchResult.message}`, 'warning');
			}

			return batchResult;
		} catch (error) {
			console.error('Error saving batch results:', error);
			showToast('Error al guardar resultados en lote', 'warning');
			return null;
		} finally {
			isSaving = false;
		}
	}

	// Función para mostrar detalles de un resultado
	function viewResultDetails(index: number) {
		if (!processedResults[index]) {
			return;
		}

		selectedResultForDetails = processedResults[index];
		showDetailsModal = true;
	}

	// Función para cerrar el modal de detalles
	function closeDetailsModal() {
		showDetailsModal = false;
	}

	// Función para reprocesar con un código específico
	async function reprocessWithCode(index: number, rollCode: string) {
		return processFile(index, rollCode);
	}

	async function selectEval(evalItem: Eval) {
		selectedEval = evalItem as unknown as EvalWithSections;

		// Fetch questions for this evaluation if not already loaded
		if (evalItem.code !== data.evalCode || evalQuestions.length === 0) {
			try {
				const response = await fetch(`/api/eval/questions/${evalItem.code}`);
				if (response.ok) {
					const data = await response.json();
					evalQuestions = data;
					// Update URL with eval code for direct access/refresh
					goto(`?eval=${evalItem.code}`, { replaceState: true, keepFocus: true });
				} else {
					showToast('Error al cargar preguntas de la evaluación', 'warning');
					evalQuestions = [];
				}
			} catch (error) {
				console.error('Error fetching questions:', error);
				showToast('Error al cargar preguntas de la evaluación', 'warning');
				evalQuestions = [];
			}
		}

		evalModal?.close();
	}

	// Limpiar URLs al desmontar
	$effect(() => () => currentPreview && URL.revokeObjectURL(currentPreview));
</script>

<PageTitle title="Next-OMR" description="Procesa hojas de respuestas de evaluaciones.">
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
		<div class="card-body p-4 border-b border-base-300/30">
			<div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
				<div class="flex flex-wrap gap-2 items-center">
					<div class="join">
						<label
							class="btn join-item btn-primary btn-sm {!selectedEval?.code ? 'btn-disabled' : ''}"
						>
							<Plus size={16} />
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
							class="btn btn-accent btn-sm {isBatchProcessing ? 'btn-disabled' : ''}"
							onclick={processAllFiles}
							disabled={isBatchProcessing || pendingFilesCount === 0 || !selectedEval}
						>
							{#if isBatchProcessing}
								<Loader2 class="animate-spin mr-1" size={16} />
								Procesando...
							{:else}
								<Play size={16} class="mr-1" />
								Procesar ({pendingFilesCount})
							{/if}
						</button>
					{/if}
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
				<Message description="Todos los archivos han sido procesados." type="success" />
			{/if}
		</div>

		<!-- Contenido principal: archivos y previsualización -->
		<div class="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-base-300/30">
			<!-- Panel de archivos -->
			<div class="w-full lg:w-1/2 p-4">
				<header class="flex items-center justify-between mb-4">
					<h3 class="font-bold text-lg">Archivos</h3>
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
								>{Object.values(processedResults).filter((r) => r.status === 'success')
									.length}</span
							>
							<span class="text-sm">procesados</span>
						</div>
					</div>
				</header>

				{#if uploadedFiles.length > 0}
					<FileTable
						files={uploadedFiles}
						{processedResults}
						selectedIndex={selectedFileIndex}
						{isProcessing}
						{processingIndex}
						{isSaving}
						{savingIndex}
						evalSelected={!!selectedEval}
						onSelect={(index) => (selectedFileIndex = index)}
						onProcess={(index, rollCode = null) => processFile(index, rollCode)}
						onRemove={removeFile}
						onViewDetails={viewResultDetails}
						onSave={saveResult}
						onReprocess={reprocessWithCode}
					/>

					<!-- Botón para guardar todos los resultados -->
					{#if Object.values(processedResults).some((r) => r.status === 'success' && r.student && !r.saved)}
						<div class="mt-4 flex justify-end">
							<button class="btn btn-primary btn-sm" onclick={saveAllResults} disabled={isSaving}>
								{#if isSaving}
									<span class="loading loading-spinner loading-xs"></span>
								{:else}
									<Save size={14} class="mr-1" />
								{/if}
								Guardar Todos los Resultados
							</button>
						</div>
					{/if}
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
			<div class="w-full lg:w-1/2">
				{#if uploadedFiles.length > 0}
					<ImagePreview
						imageUrl={currentPreview}
						status={previewStatus}
						fileIndex={selectedFileIndex}
						totalFiles={uploadedFiles.length}
						onImageSave={handleProcessedImage}
					/>
				{:else}
					<div class="card-body flex flex-col items-center justify-center p-8 text-center">
						<div class="bg-base-100/50 rounded-lg border border-base-300/30 p-8 w-full max-w-md">
							<School size={64} class="text-primary/30 mx-auto mb-4" />
							<h3 class="text-lg font-bold mb-2">Listo para procesar</h3>
							<p class="text-base-content/70 mb-4">
								Carga imágenes de hojas de respuestas para comenzar
							</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

<!-- Modal de detalles -->
{#if selectedResultForDetails}
	<OmrDetailsModal
		result={selectedResultForDetails}
		open={showDetailsModal}
		onClose={closeDetailsModal}
	/>
{/if}

<!-- Modal de selección de evaluación -->
<dialog bind:this={evalModal} class="modal">
	<div class="modal-box">
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
