<script lang="ts">
	import { enhance } from '$app/forms';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import EvalHeader from '$lib/components/EvalHeader.svelte';
	import EvalDetails from '$lib/components/EvalDetails.svelte';
	import FileTable from '$lib/components/FileTable.svelte';
	import ImagePreview from '$lib/components/ImagePreview.svelte';
	import Message from '$lib/components/Message.svelte';
	import OmrDetailsModal from '$lib/components/OmrDetailsModal.svelte';
	import EvaluationSelectionModal from '$lib/components/EvaluationSelectionModal.svelte';
	import {
		Upload,
		Trash2,
		X,
		School,
		Play,
		Loader2,
		Plus,
		Save,
		AlertTriangle,
		Check,
		Image as ImageIcon
	} from 'lucide-svelte';
	import type { Level, EvalWithSections, EvalQuestion } from '$lib/types';
	import type { FileEntry } from '$lib/types/app';
	import { showToast } from '$lib/stores/Toast';
	import { base64ToFile, validateA5Proportion } from '$lib/utils/imageUtils';
	import type { ApiOmrBatchResponse, ApiOmrBatchRequest } from '$lib/types/api';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { permissionsStore } from '$lib/stores/permissions';
	import { evaluationStore } from '$lib/stores/evaluation';

	interface ValidationError {
		id: string;
		message: string;
	}

	// Props
	const { data } = $props<{
		data: {
			levels: Level[];
			serverQuestions: EvalQuestion[];
		};
	}>();

	// Permissions
	const canSaveResults = permissionsStore.has({ entity: 'eval_results', action: 'create' });

	// Store state
	let storeState = $state({
		selectedEval: null as EvalWithSections | null,
		selectedLevelCode: '',
		availableEvals: [] as EvalWithSections[],
		isLoading: false
	});

	// Subscribe to the store
	$effect(() => {
		const unsubscribe = evaluationStore.subscribe((state) => {
			storeState = state;
		});
		return unsubscribe;
	});

	// Initialize the store from URL parameters
	onMount(() => {
		// Initialize with empty values since this page doesn't have URL parameters
		evaluationStore.initFromUrl('', null, 'eval-check-page');
	});

	// Estado
	let evalQuestions = $state<EvalQuestion[]>(data.serverQuestions || []);
	let fileEntries = $state<FileEntry[]>([]);
	let selectedFileId = $state<string | null>(null);
	let isProcessingBatch = $state(false);
	let isSavingBatch = $state(false);
	let detailsModalOpen = $state(false);
	let evalSelectionModalOpen = $state(false);
	let batchProgress = $state({ processed: 0, total: 0 });
	let processingStartTime = $state<number>(0);
	let abortController = $state<AbortController | null>(null);

	// Valores derivados
	let currentPreviewUrl = $derived.by(() => {
		if (!selectedFileId) return '';
		const entry = fileEntries.find((e) => e.id === selectedFileId);
		if (!entry || !entry.file) return '';
		const url = URL.createObjectURL(entry.file);
		return url ?? '';
	});
	let selectedFileResult = $derived(
		selectedFileId ? fileEntries.find((e) => e.id === selectedFileId)?.result : null
	);
	let selectedFileError = $derived(
		selectedFileId ? fileEntries.find((e) => e.id === selectedFileId)?.error : null
	);
	let pendingFilesCount = $derived(fileEntries.filter((e) => e.status === 'pending').length);
	let successFilesCount = $derived(fileEntries.filter((e) => e.status === 'success').length);
	let errorFilesCount = $derived(fileEntries.filter((e) => e.status === 'error').length);
	let saveableFilesCount = $derived(
		fileEntries.filter((e) => e.status === 'success' && !!e.result?.register_code && !e.saved)
			.length
	);

	// Lógica de validación extraída
	function getValidationErrors(entries: FileEntry[]): ValidationError[] {
		const errors: ValidationError[] = [];
		const rollCodes = new Map<string, string[]>();

		for (const entry of entries) {
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

		entries.forEach((entry) => {
			if (entry.status === 'pending' && !entry.formatValid) {
				errors.push({
					id: entry.id,
					message: `Formato no A5: ${entry.formatName}`
				});
			}
			if (entry.status === 'success' && !entry.result?.register_code) {
				errors.push({
					id: entry.id,
					message: `Estudiante no encontrado (${entry.result?.roll_code})`
				});
			}
			if (entry.status === 'error' && entry.error?.code !== 'STUDENT_NOT_FOUND') {
				errors.push({ id: entry.id, message: `Error: ${entry.error?.message || 'Desconocido'}` });
			}
		});

		return errors;
	}

	let validationErrors = $derived.by(() => {
		// Solo validar cuando no esté procesando para mejor performance
		if (isProcessingBatch) return [];
		return getValidationErrors(fileEntries);
	});
	let validationErrorsMap = $derived(new Map(validationErrors.map((err) => [err.id, err.message])));

	// Estimación de tiempo restante
	let estimatedTime = $derived.by(() => {
		if (!isProcessingBatch || batchProgress.processed === 0 || processingStartTime === 0) return '';

		const elapsed = Date.now() - processingStartTime;
		const avgTimePerFile = elapsed / batchProgress.processed;
		const remaining = (batchProgress.total - batchProgress.processed) * avgTimePerFile;

		if (remaining < 60000) {
			return `${Math.ceil(remaining / 1000)}s restantes`;
		} else {
			return `${Math.ceil(remaining / 60000)}m restantes`;
		}
	});

	let canProcess = $derived(
		!!storeState.selectedEval &&
			fileEntries.length > 0 &&
			!fileEntries.some((e) => e.status === 'pending' && !e.formatValid)
	);
	let canSave = $derived(
		saveableFilesCount > 0 &&
			validationErrors.length === 0 &&
			!isProcessingBatch &&
			!isSavingBatch &&
			pendingFilesCount === 0 &&
			errorFilesCount === fileEntries.filter((e) => e.error?.code === 'STUDENT_NOT_FOUND').length
	);

	// Funciones auxiliares

	async function processFile(
		id: string,
		rollCodeOverride: string | null = null,
		skipSelection: boolean = false
	): Promise<void> {
		const entryIndex = fileEntries.findIndex((e) => e.id === id);
		if (entryIndex === -1 || !storeState.selectedEval) return;

		if (!fileEntries[entryIndex].formatValid) {
			showToast(
				`No se puede procesar: ${fileEntries[entryIndex].formatName}. Recorta la imagen.`,
				'info'
			);
			return;
		}

		fileEntries[entryIndex].status = 'processing';
		fileEntries[entryIndex].result = null;
		fileEntries[entryIndex].error = null;

		if (!skipSelection) {
			selectedFileId = id;
		}

		try {
			const file = fileEntries[entryIndex].file;
			// Usar la misma función de optimización que en el procesamiento por lotes
			const imageData = await readAndOptimizeImage(file);

			// Usar el endpoint de batch incluso para un solo archivo
			// para mantener consistencia y reutilizar código
			const response = await fetch('/api/eval/omr-batch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					evalCode: storeState.selectedEval.code,
					evalGroupName: storeState.selectedEval.group_name,
					evalLevelCode: storeState.selectedEval.level_code,
					items: [
						{
							id,
							imageData,
							rollCode: rollCodeOverride
						}
					],
					sections: storeState.selectedEval.eval_sections,
					questions: evalQuestions
				} as ApiOmrBatchRequest)
			});

			if (!response.ok) {
				throw new Error(`Error en la respuesta del servidor: ${response.status}`);
			}

			const batchResponse = (await response.json()) as ApiOmrBatchResponse;

			if (!batchResponse.success || batchResponse.results.length === 0) {
				throw new Error(batchResponse.error?.message || 'Error desconocido en el procesamiento');
			}

			const result = batchResponse.results[0]; // Solo debería haber un resultado

			if (result.success && result.data) {
				fileEntries[entryIndex].status = 'success';
				fileEntries[entryIndex].result = result.data;
				fileEntries[entryIndex].saved = false;
				if (!isProcessingBatch) {
					showToast(
						result.data.student
							? `Procesado: ${result.data.student.name} ${result.data.student.last_name}`
							: `Procesado: Código ${result.data.roll_code} (Estudiante no encontrado)`,
						'success'
					);
				}
			} else if (!result.success && result.error) {
				fileEntries[entryIndex].status = 'error';
				fileEntries[entryIndex].error = result.error;
				if (!isProcessingBatch) {
					showToast(`Error en ${file.name}: ${result.error?.message || 'Desconocido'}`, 'warning');
				}
			}
		} catch (error) {
			fileEntries[entryIndex].status = 'error';
			fileEntries[entryIndex].error = {
				code: 'INTERNAL_ERROR',
				message: error instanceof Error ? error.message : 'Error de red o desconocido'
			};
			if (!isProcessingBatch) {
				showToast(`Error al procesar archivo`, 'danger');
			}
		}
	}

	async function processAllPendingFiles() {
		if (!storeState.selectedEval || isProcessingBatch || pendingFilesCount === 0) return;
		isProcessingBatch = true;
		processingStartTime = Date.now();
		abortController = new AbortController();

		const previousSelectedId = selectedFileId;
		// Chunk size dinámico basado en cantidad de archivos
		const pendingCount = fileEntries.filter((e) => e.status === 'pending' && e.formatValid).length;
		const CHUNK_SIZE = Math.min(10, Math.max(3, Math.floor(pendingCount / 4)));

		try {
			const pendingEntries = fileEntries.filter((e) => e.status === 'pending' && e.formatValid);
			if (pendingEntries.length === 0) {
				showToast('No hay archivos válidos para procesar. Corrige el formato A5.', 'warning');
				return;
			}

			// Inicializar progreso
			batchProgress = { processed: 0, total: pendingEntries.length };

			// Marcar todos los archivos pendientes como "processing"
			for (const entry of pendingEntries) {
				const entryIndex = fileEntries.findIndex((e) => e.id === entry.id);
				if (entryIndex !== -1) {
					fileEntries[entryIndex].status = 'processing';
					fileEntries[entryIndex].result = null;
					fileEntries[entryIndex].error = null;
				}
			}

			// Dividir en chunks para evitar payloads demasiado grandes
			const chunks = [];
			for (let i = 0; i < pendingEntries.length; i += CHUNK_SIZE) {
				chunks.push(pendingEntries.slice(i, i + CHUNK_SIZE));
			}

			// Procesar cada chunk secuencialmente
			for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
				const chunk = chunks[chunkIndex];

				// Optimización: Convertir imágenes a base64 en paralelo
				const batchItems = await Promise.all(
					chunk.map(async (entry) => {
						// Optimización: Comprimir imágenes antes de enviar
						const imageData = await readAndOptimizeImage(entry.file);
						return {
							id: entry.id,
							imageData
						};
					})
				);

				// Enviar solicitud de procesamiento por lotes
				const response = await fetch('/api/eval/omr-batch', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					signal: abortController?.signal,
					body: JSON.stringify({
						evalCode: storeState.selectedEval.code,
						evalGroupName: storeState.selectedEval.group_name,
						evalLevelCode: storeState.selectedEval.level_code,
						items: batchItems,
						// Solo enviar secciones y preguntas en el primer chunk para reducir payload
						sections: chunkIndex === 0 ? storeState.selectedEval.eval_sections : undefined,
						questions: chunkIndex === 0 ? evalQuestions : undefined
					} as ApiOmrBatchRequest)
				});

				if (!response.ok) {
					throw new Error(`Error en la respuesta del servidor: ${response.status}`);
				}

				const batchResponse = (await response.json()) as ApiOmrBatchResponse;

				if (!batchResponse.success) {
					throw new Error(
						batchResponse.error?.message || 'Error desconocido en el procesamiento por lotes'
					);
				}

				// Procesar resultados
				for (const result of batchResponse.results) {
					const entryIndex = fileEntries.findIndex((e) => e.id === result.id);
					if (entryIndex === -1) continue;

					if (result.success && result.data) {
						fileEntries[entryIndex].status = 'success';
						fileEntries[entryIndex].result = result.data;
						fileEntries[entryIndex].error = null;
						fileEntries[entryIndex].saved = false;
					} else if (!result.success && result.error) {
						fileEntries[entryIndex].status = 'error';
						fileEntries[entryIndex].error = result.error;
						fileEntries[entryIndex].result = null;
					}

					// Actualizar progreso
					batchProgress.processed++;
				}

				// Mostrar progreso parcial
				if (chunks.length > 1) {
					showToast(
						`Procesando lote ${chunkIndex + 1}/${chunks.length} (${batchProgress.processed}/${batchProgress.total})`,
						'info'
					);
				}
			}

			showToast('Procesamiento por lotes completado', 'success');
		} catch (error) {
			// Verificar si fue cancelado
			if (error instanceof Error && error.name === 'AbortError') {
				showToast('Procesamiento cancelado', 'info');
			} else {
				showToast('Error durante el procesamiento por lotes', 'danger');
				console.error('Batch processing error:', error);
			}

			// Marcar todos los archivos en procesamiento como pendientes nuevamente
			for (const entry of fileEntries) {
				if (entry.status === 'processing') {
					entry.status = 'pending';
				}
			}
		} finally {
			// Reiniciar estado
			batchProgress = { processed: 0, total: 0 };
			processingStartTime = 0;
			abortController = null;

			if (previousSelectedId && fileEntries.some((e) => e.id === previousSelectedId)) {
				selectedFileId = previousSelectedId;
			} else if (fileEntries.length > 0) {
				selectedFileId = fileEntries[0].id;
			}
			isProcessingBatch = false;
		}
	}

	// Función para cancelar el procesamiento
	function cancelProcessing() {
		if (abortController && isProcessingBatch) {
			abortController.abort();
		}
	}

	// Función para optimizar imágenes antes de enviarlas
	async function readAndOptimizeImage(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					// Crear un canvas para redimensionar/comprimir la imagen
					const canvas = document.createElement('canvas');
					// Mantener la proporción A5 pero reducir tamaño si es muy grande
					const MAX_WIDTH = 1240; // Ancho máximo razonable para OMR
					const MAX_HEIGHT = 1748; // Alto máximo para mantener proporción A5

					let width = img.width;
					let height = img.height;

					// Redimensionar solo si la imagen es más grande que los límites
					if (width > MAX_WIDTH || height > MAX_HEIGHT) {
						if (width / height > MAX_WIDTH / MAX_HEIGHT) {
							// Más ancha que alta en proporción
							width = MAX_WIDTH;
							height = Math.floor(img.height * (MAX_WIDTH / img.width));
						} else {
							// Más alta que ancha en proporción
							height = MAX_HEIGHT;
							width = Math.floor(img.width * (MAX_HEIGHT / img.height));
						}
					}

					canvas.width = width;
					canvas.height = height;

					// Dibujar la imagen redimensionada
					const ctx = canvas.getContext('2d');
					if (!ctx) {
						resolve(e.target?.result as string); // Fallback al original si no se puede comprimir
						return;
					}

					ctx.drawImage(img, 0, 0, width, height);

					// Convertir a base64 con calidad reducida para JPEG
					const quality = 0.85; // 85% de calidad, buen balance entre tamaño y calidad
					const dataUrl = canvas.toDataURL('image/jpeg', quality);
					resolve(dataUrl);
				};
				img.onerror = () => reject(new Error('Error al cargar la imagen para optimización'));
				img.src = e.target?.result as string;
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const newFiles = Array.from(input.files).filter((file) => file.type.startsWith('image/'));
		if (newFiles.length < input.files.length) {
			showToast('Algunos archivos no son imágenes y fueron ignorados', 'warning');
		}

		const newEntries: FileEntry[] = [];
		let invalidFormatCount = 0;

		for (const file of newFiles) {
			let formatValid = true;
			let formatName = 'A5 Vertical';

			try {
				const url = URL.createObjectURL(file);
				const dimensions = await getImageDimensions(url);
				URL.revokeObjectURL(url);

				const validation = validateA5Proportion(dimensions.width, dimensions.height);
				formatValid = validation.isValid;
				formatName = validation.format;

				if (!validation.isValid) {
					invalidFormatCount++;
				}
			} catch (error) {
				console.error('Error validando formato de imagen:', error);
			}

			const entry: FileEntry = {
				file,
				id: crypto.randomUUID(),
				status: 'pending',
				result: null,
				error: null,
				saved: false,
				formatValid,
				formatName
			};

			newEntries.push(entry);
		}

		fileEntries = [...fileEntries, ...newEntries];
		if (newEntries.length > 0) selectedFileId = newEntries[newEntries.length - 1].id;

		if (invalidFormatCount > 0) {
			showToast(
				`${newFiles.length} imagen(es) cargada(s). ${invalidFormatCount} no admitidos.`,
				'warning'
			);
		} else {
			showToast(`${newFiles.length} imagen(es) cargada(s)`, 'info');
		}

		input.value = '';
	}

	async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
			img.onerror = () => reject(new Error('Error cargando imagen'));
			img.src = url;
		});
	}

	function clearFiles() {
		// No need to revoke object URLs for File objects
		fileEntries = [];
		selectedFileId = null;
		showToast('Archivos eliminados', 'success');
	}

	function removeFile(id: string) {
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

	function openEvalModal() {
		evalSelectionModalOpen = true;
	}

	async function handleLevelChange(levelCode: string) {
		await evaluationStore.setLevelCode(levelCode, 'eval-check-page');
	}

	async function selectEvalAndFetchQuestions(evalItem: EvalWithSections) {
		evaluationStore.setSelectedEval(evalItem);

		fileEntries = fileEntries.map((entry) => ({
			...entry,
			status: 'pending',
			result: null,
			error: null,
			saved: false,
			formatValid: entry.formatValid,
			formatName: entry.formatName
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
				evaluationStore.setSelectedEval(null);
			}
		} catch (error) {
			console.error('Error fetching questions:', error);
			showToast('Error al cargar preguntas de la evaluación', 'danger');
			evalQuestions = [];
			evaluationStore.setSelectedEval(null);
		}
	}

	async function handleSaveImage(processedImageData: string) {
		const entryIndex = fileEntries.findIndex((e) => e.id === selectedFileId);
		if (entryIndex === -1) return;
		const originalFile = fileEntries[entryIndex].file;
		const newFile = base64ToFile(processedImageData, originalFile.name);

		let formatValid = true;
		let formatName = 'A5 Vertical';

		try {
			const dimensions = await getImageDimensions(processedImageData);
			const validation = validateA5Proportion(dimensions.width, dimensions.height);
			formatValid = validation.isValid;
			formatName = validation.format;

			showToast(
				validation.isValid
					? 'Imagen editada guardada localmente.'
					: `Guardado con formato Invalido: ${validation.format}`,
				validation.isValid ? 'success' : 'warning'
			);
		} catch (error) {
			console.error('Error validando formato de imagen procesada:', error);
			showToast('Imagen editada guardada localmente', 'success');
		}

		// Actualizar el archivo y sus propiedades
		fileEntries[entryIndex].file = newFile;
		fileEntries[entryIndex].formatValid = formatValid;
		fileEntries[entryIndex].formatName = formatName;
	}

	$effect(() => {
		const url = currentPreviewUrl;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});
</script>

<PageTitle
	title="Procesar Respuestas"
	description="Carga, procesa y guarda hojas de respuestas escaneadas."
>
	<button
		class="btn btn-outline btn-primary"
		onclick={openEvalModal}
		aria-label="Seleccionar evaluación"
	>
		<School size={20} class="mr-2" />
		{storeState.selectedEval ? `${storeState.selectedEval.name}` : 'Seleccionar'}
	</button>
</PageTitle>

<main class="flex flex-col h-full gap-6 p-4">
	{#if storeState.selectedEval}
		<EvalHeader
			evaluation={storeState.selectedEval}
			level={data.levels.find((l: Level) => l.code === storeState.selectedEval?.level_code)}
		>
			<EvalDetails evaluation={storeState.selectedEval} />
		</EvalHeader>
	{/if}

	<div class="card bg-base-200/80 shadow overflow-hidden">
		<div class="card-body p-4 border-b border-base-300/30">
			<div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
				<div class="flex flex-wrap gap-2 items-center">
					<div class="join">
						<label
							class="btn join-item btn-primary btn-sm {!storeState.selectedEval
								? 'btn-disabled'
								: ''}"
						>
							<Plus size={16} /> Añadir
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp"
								multiple
								class="hidden"
								onchange={handleFileUpload}
								disabled={!storeState.selectedEval || isProcessingBatch || isSavingBatch}
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
							class="btn btn-info btn-sm {isProcessingBatch ? 'btn-disabled' : ''}"
							onclick={processAllPendingFiles}
							disabled={!canProcess || isProcessingBatch || isSavingBatch}
						>
							{#if isProcessingBatch}
								<Loader2 class="animate-spin mr-1" size={16} />
								Procesando {batchProgress.processed}/{batchProgress.total}
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
							return async ({ update, result }) => {
								await update();
								isSavingBatch = false;
								if (result.type === 'success' && (result.data as { success: boolean }).success) {
									goto('/result');
								} else {
									showToast('Ocurrió un error inesperado', 'danger');
								}
							};
						}}
					>
						<input
							type="hidden"
							name="resultsToSave"
							value={JSON.stringify({
								eval_code: storeState.selectedEval && storeState.selectedEval.code,
								results: fileEntries
									.filter((e) => e.status === 'success' && !!e.result?.register_code && !e.saved)
									.map((e) => ({
										register_code: e.result!.register_code,
										roll_code: e.result!.roll_code,
										answers: e.result!.answers,
										scores: e.result!.scores
									}))
							})}
						/>
						<button
							type="submit"
							class="btn btn-success btn-soft btn-sm"
							disabled={!canSave || isSavingBatch || !$canSaveResults}
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
			<div class="divider"></div>
			{#if isProcessingBatch}
				<div class="mt-4">
					<div class="flex items-center justify-between mb-2">
						<div class="text-sm font-medium text-base-content/80">Procesando archivos...</div>
						<button
							class="btn btn-error btn-outline btn-xs"
							onclick={cancelProcessing}
							title="Cancelar procesamiento"
						>
							<X size={12} /> Cancelar
						</button>
					</div>
					<progress
						class="progress progress-primary w-full h-3"
						value={batchProgress.processed}
						max={batchProgress.total}
					></progress>
					<div class="flex justify-between items-center text-xs opacity-70 mt-2">
						<span>
							{batchProgress.processed} de {batchProgress.total} archivos
						</span>
						<div class="flex items-center gap-2">
							<span class="font-medium">
								{Math.round((batchProgress.processed / batchProgress.total) * 100 || 0)}%
							</span>
							{#if estimatedTime}
								<span class="text-info">• {estimatedTime}</span>
							{/if}
						</div>
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
						<span class="badge badge-success badge-outline gap-1.5">
							<Check size={12} />
							{successFilesCount} OK
						</span>
						<span class="badge badge-error badge-outline gap-1.5">
							<X size={12} />
							{errorFilesCount} Error
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
							evalSelected={!!storeState.selectedEval}
							onSelect={(id: string) => (selectedFileId = id)}
							onProcess={(id: string, rollCode?: string) => processFile(id, rollCode)}
							onRemove={removeFile}
							onViewDetails={viewResultDetails}
							onUpdateRollCode={(id: string, newRollCode: string) => processFile(id, newRollCode)}
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
						<label class="btn btn-primary btn-sm {!storeState.selectedEval ? 'btn-disabled' : ''}">
							<Upload size={16} class="mr-2" /> Cargar Imágenes
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp"
								multiple
								class="hidden"
								onchange={handleFileUpload}
								disabled={!storeState.selectedEval}
							/>
						</label>
					</div>
				{/if}
			</div>

			<div class="w-full lg:w-1/2 p-4">
				{#if selectedFileId && fileEntries.find((e) => e.id === selectedFileId)}
					<ImagePreview
						imageUrl={currentPreviewUrl}
						error={selectedFileError}
						status={fileEntries.find((e) => e.id === selectedFileId)!.status}
						fileIndex={fileEntries.findIndex((e) => e.id === selectedFileId)}
						totalFiles={fileEntries.length}
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
							<ImageIcon size={64} class="text-primary/30 mx-auto mb-4" />
							<h3 class="text-lg font-bold mb-2">Listo para previsualizar</h3>
							<p class="text-base-content/70 mb-4">Selecciona una imagen 😊</p>
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

<EvaluationSelectionModal
	levels={data.levels}
	availableEvals={storeState.availableEvals}
	selectedEval={storeState.selectedEval}
	selectedLevelCode={storeState.selectedLevelCode}
	open={evalSelectionModalOpen}
	loading={storeState.isLoading}
	onClose={() => (evalSelectionModalOpen = false)}
	onLevelChange={handleLevelChange}
	onSelectEval={selectEvalAndFetchQuestions}
/>
