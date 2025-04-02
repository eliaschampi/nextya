<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import {
		Upload,
		CheckCircle2,
		Play,
		Check,
		Trash2,
		X,
		School,
		AlertCircle,
		BookOpen
	} from 'lucide-svelte';
	import type { Eval, Level } from '../../../../app';
	import { formatDate } from '$lib/utils/formatDate';
	import { showToast } from '$lib/stores/Toast';

	const { data } = $props<{ evals: Eval[]; levels: Level[] }>();

	// Estados principales
	let evalModal: HTMLDialogElement | null = $state(null);
	let selectedEval = $state<Eval | null>(null);
	let uploadedFiles = $state<File[]>([]);
	let selectedFileIndex = $state<number>(-1);
	let evaluations = $state<Eval[]>([]);
	let verifiedFiles = $state<Record<number, boolean>>({});
	let selectedLevel = $state('');

	// Estado para el rectángulo de selección
	let selectionRect = $state({ top: 0, left: 0, width: 0, height: 0 });
	let isDragging = $state(false);
	let currentDragCorner = $state<string | null>(null);

	// Previsualización derivada
	let currentPreview = $derived(
		selectedFileIndex >= 0 && selectedFileIndex < uploadedFiles.length
			? URL.createObjectURL(uploadedFiles[selectedFileIndex])
			: ''
	);

	// Efecto para inicializar el rectángulo
	$effect(() => {
		if (currentPreview) {
			setTimeout(initializeSelectionRect, 100);
		}
	});

	// Efecto para manejar el resize
	$effect(() => {
		const handleResize = () => currentPreview && initializeSelectionRect();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	// Funciones para el rectángulo de selección
	function initializeSelectionRect() {
		const previewContainer = document.querySelector('.preview-container');
		if (!previewContainer) return;

		const imageContainer = previewContainer.querySelector('.relative') as HTMLElement;
		if (!imageContainer) return;

		const imageRect = imageContainer.getBoundingClientRect();
		const margin = 20;
		selectionRect = {
			top: margin,
			left: margin,
			width: imageRect.width - 2 * margin,
			height: imageRect.height - 2 * margin
		};
	}

	function startDrag(event: MouseEvent, corner: string) {
		isDragging = true;
		currentDragCorner = corner;
		event.preventDefault();
	}

	function handleDrag(event: MouseEvent) {
		if (!isDragging || !currentDragCorner || !currentPreview) return;

		const container = event.currentTarget as HTMLElement;
		const imageContainer = container.querySelector('.relative') as HTMLElement;
		if (!imageContainer) return;

		const imageRect = imageContainer.getBoundingClientRect();
		const x = Math.max(0, Math.min(event.clientX - imageRect.left, imageRect.width));
		const y = Math.max(0, Math.min(event.clientY - imageRect.top, imageRect.height));

		switch (currentDragCorner) {
			case 'topLeft':
				selectionRect = {
					...selectionRect,
					left: x,
					top: y,
					width: selectionRect.width + selectionRect.left - x,
					height: selectionRect.height + selectionRect.top - y
				};
				break;
			case 'topRight':
				selectionRect = {
					...selectionRect,
					top: y,
					width: x - selectionRect.left,
					height: selectionRect.height + selectionRect.top - y
				};
				break;
			case 'bottomLeft':
				selectionRect = {
					...selectionRect,
					left: x,
					width: selectionRect.width + selectionRect.left - x,
					height: y - selectionRect.top
				};
				break;
			case 'bottomRight':
				selectionRect = {
					...selectionRect,
					width: x - selectionRect.left,
					height: y - selectionRect.top
				};
				break;
		}
	}

	function endDrag() {
		isDragging = false;
		currentDragCorner = null;
	}

	// Funciones principales
	async function loadEvaluationsByLevel() {
		if (!selectedLevel) {
			evaluations = [];
			return;
		}
		try {
			const response = await fetch(`/api/eval/${selectedLevel}`);
			if (response.ok) {
				evaluations = await response.json();
			} else {
				evaluations = [];
			}
		} catch {
			evaluations = [];
		}
	}

	function openEvalModal() {
		evaluations = [];
		selectedLevel = '';
		evalModal?.showModal();
	}

	function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			const newFiles = Array.from(input.files);
			uploadedFiles = [...uploadedFiles, ...newFiles];
			selectedFileIndex = uploadedFiles.length - 1;
			showToast(`${newFiles.length} archivo(s) cargado(s)`, 'success');
		}
	}

	function clearFiles() {
		if (!uploadedFiles.length) return;
		uploadedFiles.forEach((file) => URL.revokeObjectURL(URL.createObjectURL(file)));
		uploadedFiles = [];
		selectedFileIndex = -1;
		verifiedFiles = {};
		showToast('Archivos eliminados', 'success');
	}

	function removeFile(index: number) {
		if (index < 0 || index >= uploadedFiles.length) return;
		URL.revokeObjectURL(URL.createObjectURL(uploadedFiles[index]));
		uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
		selectedFileIndex =
			selectedFileIndex === index
				? uploadedFiles.length
					? 0
					: -1
				: selectedFileIndex > index
					? selectedFileIndex - 1
					: selectedFileIndex;
		verifiedFiles = Object.fromEntries(
			Object.entries(verifiedFiles)
				.map(([k, v]) => [parseInt(k) > index ? parseInt(k) - 1 : parseInt(k), v])
				.filter(([k]) => typeof k === 'number' && k < uploadedFiles.length)
		);
	}

	function verifyFiles() {
		if (!uploadedFiles.length) return;
		verifiedFiles = Object.fromEntries(uploadedFiles.map((_, i) => [i, true]));
		showToast('Archivos verificados', 'success');
	}

	function processFiles() {
		if (!selectedEval || !uploadedFiles.length) return;
		if (!uploadedFiles.every((_, i) => verifiedFiles[i])) {
			showToast('Verifica todos los archivos primero', 'warning');
			return;
		}
		showToast('Procesamiento iniciado (pendiente de implementación)', 'success');
	}

	function selectEval(eval_item: Eval) {
		selectedEval = eval_item;
		evalModal?.close();
		showToast(`Evaluación "${eval_item.name}" seleccionada`, 'success');
	}

	$effect(() => () => currentPreview && URL.revokeObjectURL(currentPreview));
</script>

<PageTitle title="Verificación de Evaluaciones" description="">
	<div class="flex-1">
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="card bg-base-200 shadow hover:bg-base-300/50 transition-all duration-300 cursor-pointer"
			role="button"
			aria-label="Select Evaluation"
			onclick={openEvalModal}
		>
			<div class="card-body p-4">
				{#if selectedEval}
					<div class="flex flex-col text-center items-center gap-1">
						<div class="badge badge-primary badge-soft">
							{data.levels.find((l: Level) => l.code === selectedEval?.level_code)?.name}
						</div>
						<span class="font-bold text-lg">{selectedEval.name}</span>
						<span class="text-sm opacity-70">
							Grupo {selectedEval.group_name} • {formatDate(selectedEval.eval_date)}
						</span>
					</div>
				{:else}
					<div class="text-center p-5">Seleccionar evaluación</div>
				{/if}
			</div>
		</div>
	</div>
</PageTitle>

<div class="flex flex-col h-full gap-6 p-4">
	<!-- Barra de herramientas -->
	<div class="card bg-base-200/70 shadow hover:shadow-md transition-all duration-300">
		<div class="card-body p-4 sm:p-6">
			<div class="flex flex-wrap gap-3 justify-between items-center">
				<div class="flex flex-wrap gap-3">
					<label for="file-upload" class="btn btn-primary btn-outline gap-2 hover:scale-105">
						<Upload size={18} /> Subir Archivos
					</label>
					<input
						id="file-upload"
						type="file"
						accept="image/*"
						multiple
						class="hidden"
						onchange={handleFileUpload}
					/>
					<button
						class="btn btn-error btn-outline gap-2 hover:scale-105 {uploadedFiles.length
							? ''
							: 'btn-disabled'}"
						onclick={clearFiles}
					>
						<Trash2 size={18} /> Limpiar
					</button>
				</div>
			</div>
		</div>
	</div>

	<div class="flex flex-col lg:flex-row flex-1 gap-6">
		<!-- Panel de archivos -->
		<div
			class="w-full lg:w-1/3 card bg-base-200/70 shadow hover:shadow-md transition-all duration-300"
		>
			<div class="card-body p-4 sm:p-6">
				<div class="flex items-center justify-between mb-4">
					<h3 class="card-title text-lg font-bold">Archivos Cargados</h3>
					<div class="flex items-center gap-2">
						<span class="badge badge-primary badge-outline">{uploadedFiles.length} archivos</span>
						<button
							class="btn btn-secondary btn-sm gap-1 hover:scale-105 {uploadedFiles.length
								? ''
								: 'btn-disabled'}"
							onclick={verifyFiles}
							title="Verificar todos"
						>
							<CheckCircle2 size={16} /> Verificar
						</button>
					</div>
				</div>
				<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100/50">
					<table class="table table-zebra w-full">
						<thead class="bg-base-300/50">
							<tr>
								<th class="text-base font-semibold">Nombre</th>
								<th class="text-base font-semibold">Estado</th>
								<th class="text-base font-semibold text-right">Acciones</th>
							</tr>
						</thead>
						<tbody>
							{#each uploadedFiles as file, index (index)}
								<tr
									class="hover:bg-base-300/50 cursor-pointer {selectedFileIndex === index
										? 'bg-primary/10'
										: ''}"
									onclick={() => (selectedFileIndex = index)}
								>
									<td class="font-medium truncate max-w-[150px]" title={file.name}>
										{file.name}
										<div class="text-xs opacity-70">{Math.round(file.size / 1024)} KB</div>
									</td>
									<td>
										{#if verifiedFiles[index]}
											<span class="badge badge-success gap-1"><Check size={12} /> Verificado</span>
										{:else}
											<span class="badge badge-warning gap-1"
												><AlertCircle size={12} /> Pendiente
											</span>
										{/if}
									</td>
									<td class="text-right">
										<button
											class="btn btn-ghost btn-xs hover:bg-base-300"
											onclick={(e) => {
												e.stopPropagation();
												removeFile(index);
											}}
											title="Eliminar"
										>
											<X size={16} />
										</button>
									</td>
								</tr>
							{:else}
								<tr
									><td colspan="3" class="text-center text-base-content/50 py-8"
										>No hay archivos cargados</td
									></tr
								>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
		<!-- Panel de previsualización -->
		<div class="flex-1 card bg-base-200/70 shadow hover:shadow-md transition-all duration-300">
			<div class="card-body p-4 sm:p-6">
				<div class="flex items-center justify-between mb-4">
					<h3 class="card-title text-lg font-bold">Previsualización</h3>
					{#if currentPreview}
						<div class="flex items-center gap-2">
							<span class="badge badge-success gap-2"
								><Check size={14} /> Archivo {selectedFileIndex + 1} de {uploadedFiles.length}</span
							>
							{#if verifiedFiles[selectedFileIndex]}
								<span class="badge badge-success gap-1"><Check size={12} /> Verificado</span>
							{:else}
								<span class="badge badge-warning gap-1"><AlertCircle size={12} /> Pendiente</span>
							{/if}
						</div>
					{/if}
				</div>
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					class="flex-1 flex items-center justify-center bg-base-300/50 rounded-lg p-6 border-2 border-base-content/10 min-h-[400px] relative preview-container"
					onmousemove={handleDrag}
					onmouseup={endDrag}
					onmouseleave={endDrag}
					role="application"
					aria-label="Previsualización"
				>
					{#if currentPreview}
						<div class="relative max-w-full max-h-[65vh]">
							<div
								class="absolute w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg cursor-move"
								style="top: {selectionRect.top}px; left: {selectionRect.left}px;"
								onmousedown={(e) => startDrag(e, 'topLeft')}
								role="button"
								tabindex="0"
								aria-label="Ajustar esquina superior izquierda"
								title="Arrastre para ajustar"
							></div>
							<div
								class="absolute w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg cursor-move"
								style="top: {selectionRect.top}px; left: {selectionRect.left +
									selectionRect.width}px;"
								onmousedown={(e) => startDrag(e, 'topRight')}
								role="button"
								tabindex="0"
								aria-label="Ajustar esquina superior derecha"
								title="Arrastre para ajustar"
							></div>
							<div
								class="absolute w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg cursor-move"
								style="top: {selectionRect.top +
									selectionRect.height}px; left: {selectionRect.left}px;"
								onmousedown={(e) => startDrag(e, 'bottomLeft')}
								role="button"
								tabindex="0"
								aria-label="Ajustar esquina inferior izquierda"
								title="Arrastre para ajustar"
							></div>
							<div
								class="absolute w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg cursor-move"
								style="top: {selectionRect.top +
									selectionRect.height}px; left: {selectionRect.left + selectionRect.width}px;"
								onmousedown={(e) => startDrag(e, 'bottomRight')}
								role="button"
								tabindex="0"
								aria-label="Ajustar esquina inferior derecha"
								title="Arrastre para ajustar"
							></div>
							<img
								src={currentPreview}
								alt="Vista previa"
								class="max-w-full max-h-[65vh] object-contain rounded-lg shadow"
							/>
						</div>
					{:else}
						<div class="text-center text-base-content/50 space-y-4">
							<Upload size={48} class="mx-auto opacity-20" />
							<p class="text-lg">Seleccione un archivo para previsualizar</p>
						</div>
					{/if}
				</div>
				<div class="flex justify-between items-center mt-6">
					<div class="text-sm text-base-content/70">
						{#if currentPreview}<p>Arrastre las esquinas para definir el área de detección.</p>{/if}
					</div>
					<button
						class="btn btn-primary gap-2 hover:scale-105 {selectedEval && uploadedFiles.length
							? ''
							: 'btn-disabled'}"
						onclick={processFiles}
					>
						<Play size={20} /> Procesar Archivos
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Modal de selección de evaluación -->
<dialog bind:this={evalModal} class="modal">
	<div class="modal-box w-11/12 shadow">
		<div class="flex items-center justify-between mb-6">
			<h3 class="text-lg font-bold flex items-center gap-2">
				<School class="w-6 h-6 text-primary" />
				Seleccionar Evaluación
			</h3>
			<button
				class="btn btn-circle btn-ghost hover:bg-base-200"
				onclick={() => evalModal?.close()}
				aria-label="Cerrar"
			>
				<X size={20} />
			</button>
		</div>
		<div class="bg-base-200 rounded-xl p-4 mb-6">
			<label class="label font-semibold text-primary flex items-center mb-2">
				<BookOpen class="w-5 h-5 mr-2" /> Selecciona un Nivel
			</label>
			<select
				class="select select-bordered w-full focus:ring-2 focus:ring-primary"
				bind:value={selectedLevel}
				onchange={loadEvaluationsByLevel}
			>
				<option value="">Elige un nivel</option>
				{#each data.levels as level (level.code)}
					<option value={level.code}>{level.name}</option>
				{/each}
			</select>
		</div>
		<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-200/30">
			<table class="table table-zebra w-full">
				<thead class="bg-base-300/50">
					<tr>
						<th class="font-semibold">Nombre</th>
						<th class="font-semibold text-center">Grupo</th>
						<th class="font-semibold text-center">Fecha</th>
					</tr>
				</thead>
				<tbody>
					{#each evaluations as item (item.code)}
						<tr class="hover:bg-base-300/30 cursor-pointer" onclick={() => selectEval(item)}>
							<td class="font-medium">{item.name}</td>
							<td class="text-center">
								<span class="badge badge-ghost">{item.group_name}</span>
							</td>
							<td class="text-center text-sm opacity-70">{formatDate(item.eval_date)}</td>
						</tr>
					{/each}
					{#if evaluations.length === 0}
						<tr>
							<td colspan="3" class="text-center py-8 text-base-content/50">
								No hay evaluaciones disponibles
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
