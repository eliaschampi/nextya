<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { Upload, Trash2, X, School, BookOpen, Play, Loader2, Plus, Save } from 'lucide-svelte';
	import type { Eval, Level, EvalWithSections, EvalQuestion } from '../../../../app';
	import { formatDate } from '$lib/utils/formatDate';
	import { showToast } from '$lib/stores/Toast';
	import { base64ToFile } from '$lib/utils/imageUtils';
	import EvalDetails from '$lib/components/EvalDetails.svelte';
	import EvalHeader from '$lib/components/EvalHeader.svelte';
	import FileTable from '$lib/components/FileTable.svelte';
	import ImagePreview from '$lib/components/ImagePreview.svelte';
	import Message from '$lib/components/Message.svelte';
	import OmrDetailsModal from '$lib/components/OmrDetailsModal.svelte';
	import type { OmrProcessedResult } from '$lib/types/omrProcessing';

	const { data } = $props<{
		data: { levels: Level[]; questions: EvalQuestion[]; evalCode?: string };
	}>();

	let appState = $state({
		modal: null as HTMLDialogElement | null,
		selectedEval: null as EvalWithSections | null,
		files: [] as File[],
		selectedFileIndex: -1,
		evaluations: [] as Eval[],
		level: '',
		processing: { isActive: false, index: -1, isBatch: false },
		saving: { isActive: false, index: -1 },
		details: { showModal: false, selectedResult: null as OmrProcessedResult | null },
		processedResults: {} as Record<number, OmrProcessedResult>
	});

	let evalQuestions = $state<EvalQuestion[]>(data.questions || []);

	let currentPreview = $derived(
		appState.selectedFileIndex >= 0 && appState.selectedFileIndex < appState.files.length
			? URL.createObjectURL(appState.files[appState.selectedFileIndex])
			: ''
	);

	let pendingFilesCount = $derived(
		appState.files.filter(
			(_, index) =>
				!appState.processedResults[index] || appState.processedResults[index]?.status === 'error'
		).length
	);

	let previewStatus: 'pending' | 'processing' | 'success' | 'error' | undefined = $derived(
		appState.processing.isActive && appState.processing.index === appState.selectedFileIndex
			? 'processing'
			: appState.processedResults[appState.selectedFileIndex]?.status === 'success'
				? 'success'
				: appState.processedResults[appState.selectedFileIndex]?.status === 'error'
					? 'error'
					: 'pending'
	);

	async function readFileAsDataURL(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function processSingleFile(
		index: number,
		rollCode: string | null = null
	): Promise<OmrProcessedResult | null> {
		if (!appState.selectedEval || !appState.files[index]) {
			showToast('No se puede procesar este archivo', 'warning');
			return null;
		}

		try {
			appState.processing.isActive = true;
			appState.processing.index = index;
			appState.selectedFileIndex = index;

			const file = appState.files[index];
			const imageData = await readFileAsDataURL(file);

			const response = await fetch('/api/eval/omr', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					imageData,
					evalData: appState.selectedEval,
					rollCode,
					questions: evalQuestions
				})
			});

			const result = await response.json();
			appState.processedResults[index] = result;

			if (!appState.processing.isBatch) {
				showToast(
					result.status === 'success'
						? result.student
							? `Procesado: ${result.student.name} ${result.student.lastName}`
							: `Estudiante no encontrado: ${result.studentCode}`
						: `Error en ${file.name}: ${result.message}`,
					result.status === 'success' ? 'success' : 'warning'
				);
			}

			return result;
		} catch (error) {
			console.error('Error procesando archivo:', error);
			appState.processedResults[index] = {
				status: 'error',
				message: error instanceof Error ? error.message : 'Error desconocido'
			};
			if (!appState.processing.isBatch)
				showToast(`Error al procesar ${appState.files[index].name}`, 'warning');
			return null;
		} finally {
			appState.processing.isActive = false;
			appState.processing.index = -1;
		}
	}

	async function saveSingleResult(index: number): Promise<void> {
		const result = appState.processedResults[index];
		if (!appState.selectedEval || !result || !result.student) {
			showToast('No se puede guardar este resultado', 'warning');
			return;
		}

		try {
			appState.saving.isActive = true;
			appState.saving.index = index;

			const saveData = {
				evalCode: appState.selectedEval.code,
				registerCode: result.student.registerCode,
				answers: result.answers || {},
				correctCount: result.results?.correctCount || 0,
				incorrectCount: result.results?.incorrectCount || 0,
				blankCount: result.results?.blankCount || 0,
				totalScore: result.results?.totalScore || 0,
				questions: evalQuestions
			};

			const response = await fetch('/api/eval/save-results', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(saveData)
			});

			const saveResult = await response.json();
			if (saveResult.status === 'success') {
				showToast(
					`Resultados guardados para ${result.student.name} ${result.student.lastName}`,
					'success'
				);
				appState.processedResults[index] = { ...result, saved: true };
			} else {
				showToast(`Error al guardar: ${saveResult.message}`, 'warning');
			}
		} catch (error) {
			console.error('Error guardando resultado:', error);
			showToast('Error al guardar resultado', 'warning');
		} finally {
			appState.saving.isActive = false;
			appState.saving.index = -1;
		}
	}

	async function loadEvaluationsByLevel() {
		if (!appState.level) {
			appState.evaluations = [];
			return;
		}
		try {
			const response = await fetch(`/api/eval/${appState.level}`);
			appState.evaluations = response.ok ? await response.json() : [];
		} catch (error) {
			console.error('Error cargando evaluaciones:', error);
			showToast('No se pudieron cargar las evaluaciones', 'danger');
			appState.evaluations = [];
		}
	}

	function openEvalModal() {
		appState.level = '';
		appState.evaluations = [];
		appState.modal?.showModal();
	}

	function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const newFiles = Array.from(input.files).filter((file) => file.type.startsWith('image/'));
		if (newFiles.length < input.files.length) {
			showToast('Algunos archivos no son imágenes y fueron ignorados', 'warning');
		}
		appState.files = [...appState.files, ...newFiles];
		appState.selectedFileIndex = appState.files.length - 1;
		showToast(`${newFiles.length} imagen(es) cargada(s)`, 'success');
	}

	function clearFiles() {
		appState.files.forEach((file) => URL.revokeObjectURL(URL.createObjectURL(file)));
		appState.files = [];
		appState.selectedFileIndex = -1;
		appState.processedResults = {};
		showToast('Archivos eliminados', 'success');
	}

	function removeFile(index: number) {
		URL.revokeObjectURL(URL.createObjectURL(appState.files[index]));
		appState.files = appState.files.filter((_, i) => i !== index);
		appState.selectedFileIndex = appState.files.length
			? Math.min(appState.selectedFileIndex, appState.files.length - 1)
			: -1;

		const newProcessedResults: Record<number, OmrProcessedResult> = {};
		Object.entries(appState.processedResults).forEach(([k, v]) => {
			const key = Number(k);
			if (key !== index) {
				const newKey = key > index ? key - 1 : key;
				newProcessedResults[newKey] = v;
			}
		});
		appState.processedResults = newProcessedResults;
	}

	async function processFile(index: number, rollCode: string | null = null) {
		await processSingleFile(index, rollCode);
	}

	async function processAllFiles() {
		if (!appState.selectedEval || !appState.files.length || appState.processing.isBatch) return;
		appState.processing.isBatch = true;
		try {
			for (let i = 0; i < appState.files.length; i++) {
				if (appState.processedResults[i]?.status !== 'success') await processSingleFile(i);
			}
			showToast('Procesamiento por lotes completado', 'success');
		} catch {
			showToast('Error en procesamiento por lotes', 'warning');
		} finally {
			appState.processing.isBatch = false;
		}
	}

	async function saveResult(index: number) {
		await saveSingleResult(index);
	}

	async function saveAllResults() {
		const validIndexes = Object.entries(appState.processedResults)
			.filter(([, r]) => r.status === 'success' && r.student && !r.saved)
			.map(([i]) => Number(i));

		if (!validIndexes.length) {
			showToast('No hay resultados válidos para guardar', 'warning');
			return;
		}

		try {
			appState.saving.isActive = true;
			for (const index of validIndexes) await saveSingleResult(index);
			showToast(`${validIndexes.length} resultados guardados`, 'success');
		} catch {
			showToast('Error al guardar en lote', 'warning');
		} finally {
			appState.saving.isActive = false;
		}
	}

	function viewResultDetails(index: number) {
		if (!appState.processedResults[index]) return;
		appState.details.selectedResult = appState.processedResults[index];
		appState.details.showModal = true;
	}

	function closeDetailsModal() {
		appState.details.showModal = false;
	}

	async function selectEval(evalItem: Eval) {
		appState.selectedEval = evalItem as unknown as EvalWithSections;

		if (evalItem.code !== data.evalCode || evalQuestions.length === 0) {
			try {
				const response = await fetch(`/api/eval/questions/${evalItem.code}`);
				if (response.ok) {
					evalQuestions = await response.json();
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

		appState.modal?.close();
	}

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
	{#if appState.selectedEval}
		<EvalHeader
			evaluation={appState.selectedEval}
			level={data.levels.find((l: Level) => l.code === appState.selectedEval?.level_code)}
		>
			<EvalDetails evaluation={appState.selectedEval} />
		</EvalHeader>
	{/if}

	<div class="card bg-base-200/80 shadow overflow-hidden">
		<div class="card-body p-4 border-b border-base-300/30">
			<div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
				<div class="flex flex-wrap gap-2 items-center">
					<div class="join">
						<label
							class="btn join-item btn-primary btn-sm {!appState.selectedEval?.code
								? 'btn-disabled'
								: ''}"
						>
							<Plus size={16} />
							<input
								type="file"
								accept="image/jpeg,image/jpg"
								multiple
								class="hidden"
								onchange={handleFileUpload}
								disabled={!appState.selectedEval?.code}
							/>
						</label>
						<button
							class="btn join-item btn-error btn-outline btn-sm"
							disabled={!appState.files.length ||
								appState.processing.isActive ||
								appState.processing.isBatch}
							onclick={clearFiles}
						>
							<Trash2 size={16} />
						</button>
					</div>

					{#if appState.files.length > 0 && pendingFilesCount > 0}
						<button
							class="btn btn-accent btn-sm {appState.processing.isBatch ? 'btn-disabled' : ''}"
							onclick={processAllFiles}
							disabled={appState.processing.isBatch ||
								pendingFilesCount === 0 ||
								!appState.selectedEval}
						>
							{#if appState.processing.isBatch}
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

			{#if appState.processing.isBatch}
				<div class="mt-2">
					<div class="w-full bg-base-300 rounded-full h-1.5 mb-1">
						<progress
							class="progress progress-primary w-100"
							value={((appState.files.length - pendingFilesCount) / appState.files.length) * 100}
						>
						</progress>
					</div>
					<div class="text-xs text-right">
						{appState.files.length - pendingFilesCount} de {appState.files.length} ({Math.round(
							((appState.files.length - pendingFilesCount) / appState.files.length) * 100
						)}%)
					</div>
				</div>
			{:else if appState.files.length > 0 && pendingFilesCount === 0}
				<Message description="Todos los archivos han sido procesados." type="success" />
			{/if}
		</div>

		<div class="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-base-300/30">
			<div class="w-full lg:w-1/2 p-4">
				<header class="flex items-center justify-between mb-4">
					<h3 class="font-bold text-lg">Archivos</h3>
					<div
						class="flex items-center gap-2 bg-base-100/50 px-3 py-1.5 rounded-lg border border-base-300/30"
					>
						<div class="flex items-center gap-1.5">
							<span class="badge badge-primary badge-sm">{appState.files.length}</span>
							<span class="text-sm">archivos</span>
						</div>
						<div class="w-0.5 h-4 bg-base-300/50"></div>
						<div class="flex items-center gap-1.5">
							<span class="badge badge-success badge-sm">
								{Object.values(appState.processedResults).filter((r) => r.status === 'success')
									.length}
							</span>
							<span class="text-sm">procesados</span>
						</div>
					</div>
				</header>

				{#if appState.files.length > 0}
					<FileTable
						files={appState.files}
						processedResults={appState.processedResults}
						selectedIndex={appState.selectedFileIndex}
						isProcessing={appState.processing.isActive}
						processingIndex={appState.processing.index}
						isSaving={appState.saving.isActive}
						savingIndex={appState.saving.index}
						evalSelected={!!appState.selectedEval}
						onSelect={(index) => (appState.selectedFileIndex = index)}
						onProcess={(index, rollCode = undefined) => processFile(index, rollCode)}
						onRemove={removeFile}
						onViewDetails={viewResultDetails}
						onSave={saveResult}
						onReprocess={(index, rollCode) => processFile(index, rollCode)}
					/>

					{#if Object.values(appState.processedResults).some((r) => r.status === 'success' && r.student && !r.saved)}
						<div class="mt-4 flex justify-end">
							<button
								class="btn btn-primary btn-sm"
								onclick={saveAllResults}
								disabled={appState.saving.isActive}
							>
								{#if appState.saving.isActive}
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
						<label
							class="btn btn-primary btn-sm {!appState.selectedEval?.code ? 'btn-disabled' : ''}"
						>
							<Upload size={16} class="mr-2" /> Cargar Imágenes
							<input
								type="file"
								accept="image/jpeg,image/jpg"
								multiple
								class="hidden"
								onchange={handleFileUpload}
								disabled={!appState.selectedEval?.code}
							/>
						</label>
					</div>
				{/if}
			</div>

			<div class="w-full lg:w-1/2">
				{#if appState.files.length > 0}
					<ImagePreview
						imageUrl={currentPreview}
						status={previewStatus}
						fileIndex={appState.selectedFileIndex}
						totalFiles={appState.files.length}
						onImageSave={(processedImageData) => {
							const fileName = appState.files[appState.selectedFileIndex].name;
							const newFile = base64ToFile(processedImageData, fileName);
							appState.files[appState.selectedFileIndex] = newFile;
							showToast('Imagen procesada correctamente', 'success');
						}}
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

{#if appState.details.selectedResult}
	<OmrDetailsModal
		result={appState.details.selectedResult}
		open={appState.details.showModal}
		onClose={closeDetailsModal}
	/>
{/if}

<dialog bind:this={appState.modal} class="modal modal-bottom sm:modal-middle">
	<div class="modal-box bg-base-100 shadow-xl rounded-xl p-6">
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-xl font-bold text-primary flex items-center gap-2">
				<School class="w-6 h-6" /> Seleccionar Evaluación
			</h3>
			<button class="btn btn-ghost btn-circle" onclick={() => appState.modal?.close()}>
				<X size={20} />
			</button>
		</div>
		<div class="bg-base-100 rounded-xl p-4 mb-6 shadow-sm">
			<label class="label font-semibold flex gap-2">
				<BookOpen class="w-5 h-5 text-primary" /> Nivel
			</label>
			<select
				class="select select-bordered w-full"
				bind:value={appState.level}
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
					{#each appState.evaluations as item (item.code)}
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
	<form method="dialog" class="modal-backdrop"><button>cerrar</button></form>
</dialog>
