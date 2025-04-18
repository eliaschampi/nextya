<script lang="ts">
	import { enhance } from '$app/forms';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import EvalHeader from '$lib/components/EvalHeader.svelte';
	import EvalDetails from '$lib/components/EvalDetails.svelte';
	import FileTable from '$lib/components/FileTable.svelte';
	import ImagePreview from '$lib/components/ImagePreview.svelte';
	import Message from '$lib/components/Message.svelte';
	import OmrDetailsModal from '$lib/components/OmrDetailsModal.svelte';
	import {
		Upload,
		Trash2,
		X,
		School,
		BookOpen,
		Play,
		Loader2,
		Plus,
		Save,
		AlertTriangle,
		Check
	} from 'lucide-svelte';
	import type { Level, EvalWithSections, EvalQuestion } from '../../../../app';
	import { formatDate } from '$lib/utils/formatDate';
	import { showToast } from '$lib/stores/Toast';
	import { base64ToFile, validateA5Proportion } from '$lib/utils/imageUtils';
	import type {
		ApiOmrResponse,
		ApiOmrSuccessData,
		ApiOmrErrorData,
		ResultToSave
	} from '$lib/types/api';

	type FileStatus = 'pending' | 'processing' | 'success' | 'error';
	interface FileEntry {
		file: File;
		id: string;
		status: FileStatus;
		result: ApiOmrSuccessData | null;
		error: ApiOmrErrorData | null;
		saved: boolean;
		formatValid?: boolean; // Indica si la imagen tiene proporción A5
		formatName?: string; // Nombre del formato detectado
	}

	// Interfaz para errores de validación
	interface ValidationError {
		id: string;
		message: string;
	}

	const { data } = $props<{
		data: {
			levels: Level[];
			serverQuestions: EvalQuestion[];
			evalCode?: string;
			initialEval?: EvalWithSections | null;
		};
	}>();

	// State declarations
	let selectedEval = $state<EvalWithSections | null>(data.initialEval ?? null);
	let evalQuestions = $state<EvalQuestion[]>(data.serverQuestions || []);
	let availableEvals = $state<EvalWithSections[]>([]);
	let selectedLevelCode = $state(data.initialEval?.level_code || '');
	let fileEntries = $state<FileEntry[]>([]);
	let selectedFileId = $state<string | null>(null);
	let isProcessingBatch = $state(false);
	let isSavingBatch = $state(false);
	let detailsModalOpen = $state(false);
	let modal = $state<HTMLDialogElement | null>(null);

	// Derived values
	let currentPreviewUrl = $derived(
		getSelectedFileEntry()?.file ? URL.createObjectURL(getSelectedFileEntry()!.file) : ''
	);
	let selectedFileResult = $derived(getSelectedFileEntry()?.result);
	let selectedFileError = $derived(getSelectedFileEntry()?.error);
	let pendingFilesCount = $derived(fileEntries.filter((e) => e.status === 'pending').length);
	let successFilesCount = $derived(fileEntries.filter((e) => e.status === 'success').length);
	let errorFilesCount = $derived(fileEntries.filter((e) => e.status === 'error').length);
	let processedFilesCount = $derived(successFilesCount + errorFilesCount);
	let saveableFilesCount = $derived(
		fileEntries.filter((e) => e.status === 'success' && !!e.result?.register_code && !e.saved)
			.length
	);

	// Validation logic
	let validationErrors = $derived<ValidationError[]>(
		(function () {
			const errors: ValidationError[] = [];
			const rollCodes = new Map<string, string[]>();

			for (const entry of fileEntries) {
				if (entry.result?.roll_code) {
					const code = entry.result.roll_code;
					if (!rollCodes.has(code)) rollCodes.set(code, []);
					rollCodes.get(code)!.push(entry.id);
				}
			}

			rollCodes.forEach((ids, code) => {
				if (ids.length > 1) {
					ids.forEach((id) => errors.push({ id, message: `Código duplicado: ${code}` }));
				}
			});

			fileEntries.forEach((entry) => {
				// Validación de formato A5
				if (entry.status === 'pending' && entry.formatValid === false) {
					errors.push({
						id: entry.id,
						message: `Formato no A5: ${entry.formatName || 'Proporción incorrecta'}`
					});
				}

				// Validación de estudiante
				if (entry.status === 'success' && !entry.result?.register_code) {
					errors.push({
						id: entry.id,
						message: `Estudiante no encontrado (${entry.result?.roll_code})`
					});
				}

				// Validación de errores de procesamiento
				if (entry.status === 'error' && entry.error?.code !== 'STUDENT_NOT_FOUND') {
					errors.push({ id: entry.id, message: `Error: ${entry.error?.message || 'Desconocido'}` });
				}
			});

			return errors;
		})()
	);

	// Convert validationErrors to a Map for FileTable
	let validationErrorsMap = $derived(new Map(validationErrors.map((err) => [err.id, err.message])));

	let canProcess = $derived(
		!!selectedEval &&
			fileEntries.length > 0 &&
			// Solo permitir procesar si no hay archivos pendientes con formato inválido
			!fileEntries.some((e) => e.status === 'pending' && e.formatValid === false)
	);
	let canSave = $derived(
		saveableFilesCount > 0 &&
			validationErrors.length === 0 &&
			!isProcessingBatch &&
			!isSavingBatch &&
			pendingFilesCount === 0 &&
			errorFilesCount === fileEntries.filter((e) => e.error?.code === 'STUDENT_NOT_FOUND').length
	);

	// Functions
	function getSelectedFileEntry(): FileEntry | undefined {
		return fileEntries.find((entry) => entry.id === selectedFileId);
	}

	async function readFileAsDataURL(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	// Process a single file with optional roll code override
	async function processFileEntry(
		id: string,
		rollCodeOverride: string | null = null,
		skipSelection: boolean = false
	): Promise<void> {
		const entryIndex = fileEntries.findIndex((e) => e.id === id);
		if (entryIndex === -1 || !selectedEval) return;

		// Verificar si el formato es válido antes de procesar
		if (fileEntries[entryIndex].formatValid === false) {
			showToast(
				`No se puede procesar: ${fileEntries[entryIndex].formatName || 'Formato no A5'}. Recorta la imagen primero.`,
				'danger'
			);
			return;
		}

		fileEntries[entryIndex] = {
			...fileEntries[entryIndex],
			status: 'processing',
			result: null,
			error: null
		};

		// Solo seleccionar el archivo si no estamos en procesamiento por lotes
		if (!skipSelection) {
			selectedFileId = id;
		}

		try {
			const file = fileEntries[entryIndex].file;
			const imageData = await readFileAsDataURL(file);
			const response = await fetch('/api/eval/omr', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					imageData,
					evalCode: selectedEval.code,
					rollCode: rollCodeOverride
				})
			});

			const apiResponse = (await response.json()) as ApiOmrResponse;

			if (response.ok && apiResponse.success) {
				fileEntries[entryIndex] = {
					...fileEntries[entryIndex],
					status: 'success',
					result: apiResponse.data,
					error: null,
					saved: false
				};
				if (!isProcessingBatch) {
					showToast(
						apiResponse.data.student
							? `Procesado: ${apiResponse.data.student.name} ${apiResponse.data.student.lastname}`
							: `Procesado: Código ${apiResponse.data.roll_code} (Estudiante no encontrado)`,
						'success'
					);
				}
			} else if (!apiResponse.success) {
				fileEntries[entryIndex] = {
					...fileEntries[entryIndex],
					status: 'error',
					result: null,
					error: apiResponse.error
				};
				if (!isProcessingBatch)
					showToast(`Error en ${file.name}: ${apiResponse.error.message}`, 'warning');
			} else {
				const errorData: ApiOmrErrorData = {
					code: 'INTERNAL_ERROR',
					message: 'Respuesta inesperada de la API.'
				};
				fileEntries[entryIndex] = {
					...fileEntries[entryIndex],
					status: 'error',
					result: null,
					error: errorData
				};
				if (!isProcessingBatch) showToast(`Error inesperado procesando ${file.name}`, 'danger');
			}
		} catch (error) {
			console.error('Error procesando archivo:', error);
			const errorData: ApiOmrErrorData = {
				code: 'INTERNAL_ERROR',
				message: error instanceof Error ? error.message : 'Error de red o desconocido'
			};
			fileEntries[entryIndex] = {
				...fileEntries[entryIndex],
				status: 'error',
				result: null,
				error: errorData
			};
			if (!isProcessingBatch) showToast(`Error al procesar archivo`, 'danger');
		}
	}

	async function processAllPendingFiles() {
		if (!selectedEval || isProcessingBatch || pendingFilesCount === 0) return;
		isProcessingBatch = true;

		// Guardar el ID del archivo seleccionado actualmente para restaurarlo después
		const previousSelectedId = selectedFileId;

		try {
			// Filtrar entradas pendientes y con formato válido (o sin validación de formato)
			const pendingEntries = fileEntries.filter(
				(e) => e.status === 'pending' && e.formatValid !== false
			);

			if (pendingEntries.length === 0) {
				showToast('No hay archivos válidos para procesar. Corrige el formato A5.', 'warning');
				return;
			}

			// Procesar todos los archivos sin cambiar la selección (skipSelection=true)
			for (const entry of pendingEntries) {
				await processFileEntry(entry.id, null, true);
			}

			showToast('Procesamiento por lotes completado', 'success');
		} catch (error) {
			showToast('Error durante el procesamiento por lotes', 'danger');
			console.error('Batch processing error:', error);
		} finally {
			// Restaurar la selección original si todavía existe, o seleccionar el primer archivo
			if (previousSelectedId && fileEntries.some((e) => e.id === previousSelectedId)) {
				selectedFileId = previousSelectedId;
			} else if (fileEntries.length > 0) {
				selectedFileId = fileEntries[0].id;
			}

			isProcessingBatch = false;
		}
	}

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const newFiles = Array.from(input.files).filter((file) => file.type.startsWith('image/'));
		if (newFiles.length < input.files.length)
			showToast('Algunos archivos no son imágenes y fueron ignorados', 'warning');

		// Validar proporción A5 para cada archivo
		const newEntries: FileEntry[] = [];
		let invalidFormatCount = 0;

		for (const file of newFiles) {
			// Crear una entrada temporal
			const entry: FileEntry = {
				file,
				id: crypto.randomUUID(),
				status: 'pending',
				result: null,
				error: null,
				saved: false
			};

			// Validar formato A5
			try {
				const url = URL.createObjectURL(file);
				const dimensions = await getImageDimensions(url);
				URL.revokeObjectURL(url);

				const validation = validateA5Proportion(dimensions.width, dimensions.height);
				entry.formatValid = validation.isValid;
				entry.formatName = validation.format;

				if (!validation.isValid) {
					invalidFormatCount++;
				}
			} catch (error) {
				console.error('Error validando formato de imagen:', error);
				// Si hay error en la validación, asumimos que es válido para no bloquear
				entry.formatValid = true;
			}

			newEntries.push(entry);
		}

		fileEntries = [...fileEntries, ...newEntries];
		if (newEntries.length > 0) selectedFileId = newEntries[newEntries.length - 1].id;

		if (invalidFormatCount > 0) {
			showToast(
				`${newFiles.length} imagen(es) cargada(s). ${invalidFormatCount} con formato no A5.`,
				'warning'
			);
		} else {
			showToast(`${newFiles.length} imagen(es) cargada(s)`, 'success');
		}

		input.value = '';
	}

	// Función auxiliar para obtener dimensiones de una imagen
	async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				resolve({
					width: img.naturalWidth,
					height: img.naturalHeight
				});
			};
			img.onerror = () => reject(new Error('Error cargando imagen'));
			img.src = url;
		});
	}

	function clearFiles() {
		fileEntries.forEach((entry) => URL.revokeObjectURL(URL.createObjectURL(entry.file)));
		fileEntries = [];
		selectedFileId = null;
		showToast('Archivos eliminados', 'success');
	}

	function removeFile(id: string) {
		const entryToRemove = fileEntries.find((e) => e.id === id);
		if (entryToRemove) URL.revokeObjectURL(URL.createObjectURL(entryToRemove.file));
		fileEntries = fileEntries.filter((entry) => entry.id !== id);
		if (selectedFileId === id)
			selectedFileId = fileEntries.length ? fileEntries[fileEntries.length - 1].id : null;
		showToast('Archivo eliminado', 'success');
	}

	function viewResultDetails(id: string) {
		const entry = fileEntries.find((e) => e.id === id);
		if (entry?.result) {
			selectedFileId = id;
			detailsModalOpen = true;
		} else if (entry?.error) {
			showToast(`Error: ${entry.error.message}`, 'warning');
		}
	}

	function closeDetailsModal() {
		detailsModalOpen = false;
	}

	async function loadEvaluationsByLevel() {
		if (!selectedLevelCode) {
			availableEvals = [];
			return;
		}
		try {
			const response = await fetch(`/api/eval/${selectedLevelCode}`);
			availableEvals = await response.json();
		} catch (error) {
			console.error('Error cargando evaluaciones:', error);
			showToast('No se pudieron cargar las evaluaciones', 'danger');
			availableEvals = [];
		}
	}

	async function selectEvalAndFetchQuestions(evalItem: EvalWithSections) {
		selectedEval = evalItem;
		modal?.close();
		fileEntries = fileEntries.map((entry) => ({
			...entry,
			status: 'pending',
			result: null,
			error: null,
			saved: false
		}));
		selectedFileId = fileEntries[0]?.id ?? null;

		try {
			const response = await fetch(`/api/eval/questions/${evalItem.code}`);
			if (response.ok) {
				evalQuestions = await response.json();
				showToast(`Evaluación '${evalItem.name}' seleccionada.`, 'success');
			} else {
				showToast('Error al cargar preguntas de la evaluación', 'warning');
				evalQuestions = [];
				selectedEval = null;
			}
		} catch (error) {
			console.error('Error fetching questions:', error);
			showToast('Error al cargar preguntas de la evaluación', 'danger');
			evalQuestions = [];
			selectedEval = null;
		}
	}

	function openEvalModal() {
		modal?.showModal();
	}

	async function handleSaveImage(processedImageData: string) {
		const entryIndex = fileEntries.findIndex((e) => e.id === selectedFileId);
		if (entryIndex === -1) return;
		const originalFile = fileEntries[entryIndex].file;
		const newFile = base64ToFile(processedImageData, originalFile.name);

		// Validar el formato de la imagen procesada
		try {
			// Crear una imagen temporal para verificar las dimensiones
			const dimensions = await getImageDimensions(processedImageData);
			const validation = validateA5Proportion(dimensions.width, dimensions.height);

			// Actualizar la entrada con el nuevo archivo y la validación de formato
			fileEntries[entryIndex] = {
				...fileEntries[entryIndex],
				file: newFile,
				formatValid: validation.isValid,
				formatName: validation.format
			};

			// Mostrar mensaje apropiado
			if (validation.isValid) {
				showToast('Imagen editada guardada localmente.', 'success');
			} else {
				showToast(`Guardado con formato Invalido: ${validation.format}`, 'warning');
			}
		} catch (error) {
			console.error('Error validando formato de imagen procesada:', error);
			// Si hay error en la validación, guardamos la imagen sin cambiar el estado de validación
			fileEntries[entryIndex] = { ...fileEntries[entryIndex], file: newFile };
			showToast('Imagen editada guardada localmente', 'success');
		}
	}

	$effect(() => {
		const url = currentPreviewUrl;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	$effect(() => {
		if (selectedLevelCode) loadEvaluationsByLevel();
		else availableEvals = [];
	});
</script>

<PageTitle
	title="Procesar Evaluación OMR"
	description="Carga, procesa y guarda hojas de respuestas escaneadas."
>
	<button
		class="btn btn-outline btn-primary"
		onclick={openEvalModal}
		aria-label="Seleccionar evaluación"
	>
		<School size={20} class="mr-2" />
		{selectedEval ? `Evaluación: ${selectedEval.name}` : 'Seleccionar Evaluación'}
	</button>
</PageTitle>

<main class="flex flex-col h-full gap-6 p-4">
	{#if selectedEval}
		<EvalHeader
			evaluation={selectedEval}
			level={data.levels.find((l: Level) => l.code === selectedEval?.level_code)}
		>
			<EvalDetails evaluation={selectedEval} />
		</EvalHeader>
	{/if}

	<div class="card bg-base-200/80 shadow overflow-hidden">
		<div class="card-body p-4 border-b border-base-300/30">
			<div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
				<div class="flex flex-wrap gap-2 items-center">
					<div class="join">
						<label class="btn join-item btn-primary btn-sm {!selectedEval ? 'btn-disabled' : ''}">
							<Plus size={16} /> Añadir
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp"
								multiple
								class="hidden"
								onchange={handleFileUpload}
								disabled={!selectedEval || isProcessingBatch || isSavingBatch}
							/>
						</label>
						<button
							class="btn join-item btn-error btn-outline btn-sm"
							disabled={fileEntries.length === 0 || isProcessingBatch || isSavingBatch}
							onclick={clearFiles}
							title="Eliminar todos los archivos de la lista"
						>
							<Trash2 size={16} /> Limpiar
						</button>
					</div>

					{#if pendingFilesCount > 0}
						<button
							class="btn btn-accent btn-sm"
							onclick={processAllPendingFiles}
							disabled={!canProcess || isProcessingBatch || isSavingBatch}
						>
							{#if isProcessingBatch}
								<Loader2 class="animate-spin mr-1" size={16} />
								Procesando...
							{:else}
								<Play size={16} class="mr-1" />
								Procesar ({pendingFilesCount})
							{/if}
						</button>
					{/if}

					<form
						method="POST"
						action="?/saveResults"
						use:enhance={() => {
							isSavingBatch = true;
							return async ({ update }) => {
								await update();
								isSavingBatch = false;
							};
						}}
					>
						<input
							type="hidden"
							name="resultsToSave"
							value={JSON.stringify(
								fileEntries
									.filter((e) => e.status === 'success' && !!e.result?.register_code && !e.saved)
									.map((e) => ({ ...e.result, eval_code: selectedEval!.code }) as ResultToSave)
							)}
						/>
						<button
							type="submit"
							class="btn btn-success btn-sm"
							disabled={!canSave || isSavingBatch}
							title={!canSave
								? 'Completa el procesamiento y corrige errores para guardar'
								: 'Guardar todos los resultados válidos'}
						>
							{#if isSavingBatch}
								<Loader2 class="animate-spin mr-1" size={16} /> Guardando...
							{:else}
								<Save size={16} class="mr-1" /> Guardar Válidos ({saveableFilesCount})
							{/if}
						</button>
					</form>
				</div>
			</div>

			{#if isProcessingBatch}
				<div class="mt-4">
					<progress
						class="progress progress-primary w-full"
						value={processedFilesCount}
						max={fileEntries.length}
					></progress>
					<div class="text-xs text-right opacity-70 mt-1">
						{processedFilesCount} de {fileEntries.length} ({Math.round(
							(processedFilesCount / fileEntries.length) * 100
						)}%)
					</div>
				</div>
			{:else if fileEntries.length > 0 && pendingFilesCount === 0 && validationErrors.length === 0 && errorFilesCount === 0}
				<Message
					description="Todos los archivos procesados y listos para guardar."
					type="success"
				/>
			{:else if fileEntries.length > 0 && pendingFilesCount === 0 && validationErrors.length > 0}
				<Message
					type="warning"
					description="Algunos archivos requieren atención antes de guardar ({validationErrors.length} problemas). Revisa la tabla."
				/>
			{/if}
		</div>

		<div class="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-base-300/30">
			<div class="w-full lg:w-1/2 p-4 flex flex-col">
				<header class="flex items-center justify-between mb-4 gap-4 flex-wrap">
					<h3 class="font-bold">Hojas de Respuestas</h3>
					<div class="flex items-center gap-2 flex-wrap">
						<span class="badge badge-ghost gap-1.5">
							<Upload size={12} />
							{fileEntries.length} Total
						</span>
						<span class="badge badge-success badge-outline gap-1.5"
							><Check size={12} /> {successFilesCount} OK
						</span>
						<span class="badge badge-error badge-outline gap-1.5"
							><X size={12} /> {errorFilesCount} Error
						</span>
						<span class="badge badge-info badge-outline gap-1.5">
							<Save size={12} />
							{fileEntries.filter((e) => e.saved).length} Guardado
						</span>
					</div>
				</header>

				{#if fileEntries.length > 0}
					<div class="flex-grow overflow-y-auto">
						<FileTable
							entries={fileEntries}
							selectedId={selectedFileId}
							processingId={isProcessingBatch
								? null
								: (fileEntries.find((e) => e.status === 'processing')?.id ?? null)}
							{validationErrorsMap}
							evalSelected={!!selectedEval}
							onSelect={(id: string) => (selectedFileId = id)}
							onProcess={(id: string, rollCode?: string) => processFileEntry(id, rollCode)}
							onRemove={removeFile}
							onViewDetails={viewResultDetails}
							onUpdateRollCode={(id: string, newRollCode: string) =>
								processFileEntry(id, newRollCode)}
						/>
					</div>

					{#if validationErrors.length > 0 && pendingFilesCount === 0 && !isProcessingBatch}
						<div class="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg text-xs">
							<p class="font-semibold mb-1 flex items-center gap-1.5">
								<AlertTriangle size={14} /> Problemas encontrados:
							</p>
							<ul class="list-disc list-inside pl-2">
								{#each Array.from(new Set(validationErrors.map((e) => e.message))) as errorMessage (errorMessage)}
									<li>{errorMessage}</li>
								{/each}
							</ul>
							<p class="mt-1 opacity-80">
								Resuelve estos problemas para poder guardar los resultados.
							</p>
						</div>
					{/if}
				{:else}
					<div
						class="flex-grow flex flex-col items-center justify-center p-8 text-center bg-base-100/50 rounded-lg border border-base-300/30"
					>
						<Upload size={48} class="text-primary/50 mb-4" />
						<p class="text-base-content/70 mb-2">No hay hojas cargadas</p>
						<p class="text-sm text-base-content/50 mb-4">
							Selecciona una evaluación y añade imágenes para procesar.
						</p>
						<label class="btn btn-primary btn-sm {!selectedEval ? 'btn-disabled' : ''}">
							<Upload size={16} class="mr-2" /> Cargar Imágenes
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp"
								multiple
								class="hidden"
								onchange={handleFileUpload}
								disabled={!selectedEval}
							/>
						</label>
					</div>
				{/if}
			</div>

			<div class="w-full lg:w-1/2 p-4">
				{#if selectedFileId && getSelectedFileEntry()}
					<ImagePreview
						imageUrl={currentPreviewUrl}
						status={getSelectedFileEntry()!.status}
						error={selectedFileError}
						result={selectedFileResult}
						fileName={getSelectedFileEntry()!.file.name}
						isA5Format={getSelectedFileEntry()!.formatValid !== false}
						formatName={getSelectedFileEntry()!.formatName || 'Formato desconocido'}
						onImageSave={handleSaveImage}
					/>
				{:else if fileEntries.length > 0}
					<div
						class="h-full flex items-center justify-center p-8 text-center bg-base-100/50 rounded-lg border border-base-300/30"
					>
						<p class="text-base-content/60">
							Selecciona un archivo de la lista para previsualizarlo.
						</p>
					</div>
				{:else}
					<div class="card-body flex flex-col items-center justify-center p-8 text-center">
						<div class="bg-base-100/50 rounded-lg border border-base-300/30 p-8 w-full max-w-md">
							<School size={64} class="text-primary/30 mx-auto mb-4" />
							<h3 class="text-lg font-bold mb-2">Listo para procesar</h3>
							<p class="text-base-content/70 mb-4">
								Selecciona una evaluación y carga imágenes para comenzar.
							</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

{#if selectedFileResult}
	<OmrDetailsModal
		result={selectedFileResult}
		questions={evalQuestions}
		open={detailsModalOpen}
		onClose={closeDetailsModal}
	/>
{/if}

<dialog bind:this={modal} class="modal modal-bottom sm:modal-middle">
	<div class="modal-box">
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-xl font-bold text-primary flex items-center gap-2">
				<School class="w-6 h-6" /> Seleccionar Evaluación
			</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
				onclick={() => modal?.close()}
			>
				<X size={20} />
			</button>
		</div>
		<div class="space-y-4">
			<div>
				<label class="label font-semibold flex items-center gap-2">
					<BookOpen class="w-5 h-5 text-secondary" /> Nivel Académico
				</label>
				<select
					class="select select-bordered w-full"
					bind:value={selectedLevelCode}
					disabled={isProcessingBatch || isSavingBatch}
				>
					<option value="">Elige un nivel</option>
					{#each data.levels as level (level.code)}
						<option value={level.code}>{level.name}</option>
					{/each}
				</select>
			</div>
			{#if selectedLevelCode}
				<div class="max-h-60 overflow-y-auto rounded-lg bg-base-200">
					<table class="table table-zebra table-pin-rows table-sm">
						<thead>
							<tr>
								<th>Nombre</th>
								<th class="text-center">Grupo</th>
								<th class="text-center">Fecha</th>
								<th class="text-center">Acción</th>
							</tr>
						</thead>
						<tbody>
							{#each availableEvals as item (item.code)}
								<tr class="hover">
									<td class="font-medium">{item.name}</td>
									<td class="text-center"
										><span class="badge badge-ghost badge-sm">{item.group_name}</span></td
									>
									<td class="text-center text-xs opacity-70">{formatDate(item.eval_date)}</td>
									<td class="text-center">
										<button
											class="btn btn-primary btn-xs"
											onclick={() => selectEvalAndFetchQuestions(item)}
											disabled={selectedEval?.code === item.code ||
												isProcessingBatch ||
												isSavingBatch}
										>
											{selectedEval?.code === item.code ? 'Seleccionado' : 'Seleccionar'}
										</button>
									</td>
								</tr>
							{:else}
								<tr
									><td colspan="4" class="text-center py-6 opacity-50">
										No hay evaluaciones para este nivel.
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>cerrar</button></form>
</dialog>
