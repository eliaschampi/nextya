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

	// Props tipados
	const { data } = $props<{ evals: Eval[]; levels: Level[] }>();

	// Estados reactivos con Svelte v5 runes
	let evalModal = $state<HTMLDialogElement | null>(null);
	let selectedEval = $state<Eval | null>(null);
	let uploadedFiles = $state<File[]>([]);
	let selectedFileIndex = $state(-1);
	let evaluations = $state<Eval[]>([]);
	let verifiedFiles = $state<Record<number, boolean>>({});
	let selectedLevel = $state('');

	// Estado del rectángulo de selección en porcentajes (0-100)
	let selectionRect = $state({ top: 10, left: 10, width: 80, height: 80 });
	let isDragging = $state(false);
	let dragCorner = $state<string | null>(null);
	let imageRef = $state<HTMLImageElement | null>(null);

	// Previsualización derivada
	let currentPreview = $derived(
		selectedFileIndex >= 0 && selectedFileIndex < uploadedFiles.length
			? URL.createObjectURL(uploadedFiles[selectedFileIndex])
			: ''
	);

	// Rectángulo absoluto derivado
	let absoluteRect = $derived(imageRef ? getAbsoluteRect(imageRef.getBoundingClientRect()) : null);

	// Funciones para el rectángulo de selección
	function getAbsoluteRect(imageRect: DOMRect) {
		return {
			top: (selectionRect.top / 100) * imageRect.height,
			left: (selectionRect.left / 100) * imageRect.width,
			width: (selectionRect.width / 100) * imageRect.width,
			height: (selectionRect.height / 100) * imageRect.height
		};
	}

	let rafId: number;
	function startDrag(event: MouseEvent, corner: string) {
		isDragging = true;
		dragCorner = corner;
		event.preventDefault();
	}

	function handleDrag(event: MouseEvent) {
		if (!isDragging || !dragCorner || !currentPreview || !imageRef) return;
		cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(() => {
			if (!imageRef) return;
			const rect = imageRef.getBoundingClientRect();
			const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
			const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
			const xPercent = (x / rect.width) * 100;
			const yPercent = (y / rect.height) * 100;

			const newRect = { ...selectionRect };
			const minSize = 5; // Porcentaje mínimo

			switch (dragCorner) {
				case 'topLeft':
					newRect.left = Math.min(xPercent, selectionRect.left + selectionRect.width - minSize);
					newRect.top = Math.min(yPercent, selectionRect.top + selectionRect.height - minSize);
					newRect.width = Math.max(
						minSize,
						selectionRect.left + selectionRect.width - newRect.left
					);
					newRect.height = Math.max(
						minSize,
						selectionRect.top + selectionRect.height - newRect.top
					);
					break;
				case 'topRight':
					newRect.top = Math.min(yPercent, selectionRect.top + selectionRect.height - minSize);
					newRect.width = Math.max(minSize, xPercent - selectionRect.left);
					newRect.height = Math.max(
						minSize,
						selectionRect.top + selectionRect.height - newRect.top
					);
					break;
				case 'bottomLeft':
					newRect.left = Math.min(xPercent, selectionRect.left + selectionRect.width - minSize);
					newRect.height = Math.max(minSize, yPercent - selectionRect.top);
					newRect.width = Math.max(
						minSize,
						selectionRect.left + selectionRect.width - newRect.left
					);
					break;
				case 'bottomRight':
					newRect.width = Math.max(minSize, xPercent - selectionRect.left);
					newRect.height = Math.max(minSize, yPercent - selectionRect.top);
					break;
			}
			selectionRect = newRect;
		});
	}

	function endDrag() {
		isDragging = false;
		dragCorner = null;
	}

	// Ajustar el rectángulo cuando cambie la imagen o el tamaño de la ventana
	function adjustSelectionRect() {
		if (!imageRef) return;
		const maxWidth = 100;
		const maxHeight = 100;

		selectionRect.left = Math.max(0, selectionRect.left);
		selectionRect.top = Math.max(0, selectionRect.top);
		selectionRect.width = Math.min(selectionRect.width, maxWidth - selectionRect.left);
		selectionRect.height = Math.min(selectionRect.height, maxHeight - selectionRect.top);
	}

	$effect(() => {
		if (selectedFileIndex >= 0 && imageRef) {
			adjustSelectionRect();
		}
	});

	$effect(() => {
		const handleResize = () => imageRef && adjustSelectionRect();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

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
		verifiedFiles = {};
		showToast('Archivos eliminados', 'success');
	}

	function removeFile(index: number) {
		URL.revokeObjectURL(URL.createObjectURL(uploadedFiles[index]));
		uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
		selectedFileIndex = uploadedFiles.length
			? Math.min(selectedFileIndex, uploadedFiles.length - 1)
			: -1;
		verifiedFiles = Object.fromEntries(
			Object.entries(verifiedFiles)
				.filter(([k]) => Number(k) !== index)
				.map(([k, v]) => [Number(k) > index ? Number(k) - 1 : Number(k), v])
		);
	}

	function verifyFiles() {
		showToast('Archivos verificados', 'success');
		// verifica, tamanio, proporcio de imagenes, de encontrar proporcion diferente a a5 vertical
		// mostrar error en el item y no permitir procesar
		// si no hay errores, marcar como verificado
		verifiedFiles = Object.fromEntries(uploadedFiles.map((_, i) => [i, true]));
	}

	async function processFiles() {
		if (
			!selectedEval ||
			!uploadedFiles.length ||
			!uploadedFiles.every((_, i) => verifiedFiles[i])
		) {
			showToast('Faltan requisitos para procesar', 'warning');
			return;
		}

		try {
			for (let i = 0; i < uploadedFiles.length; i++) {
				const file = uploadedFiles[i];
				const reader = new FileReader();

				await new Promise((resolve, reject) => {
					reader.onload = async () => {
						try {
							const imageData = reader.result as string;
							const response = await fetch('/api/omr', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									imageData,
									params: {
										numQuestions: 20, // TODO: get from eval_sections and selectedEval
										numOptions: 5,
										numCodeDigits: 4,
										selectionRect
									}
								})
							});

							const result = await response.json();

							if (result.status === 'success') {
								showToast(`Procesado: ${file.name} - Código: ${result.studentCode}`, 'success');
							} else {
								showToast(`Error en ${file.name}: ${result.message}`, 'warning');
							}
							resolve(null);
						} catch (error) {
							reject(error);
						}
					};
					reader.onerror = reject;
					reader.readAsDataURL(file);
				});
			}
			showToast('Procesamiento completado', 'success');
		} catch (error) {
			console.error('Error processing files:', error);
			showToast('Error al procesar archivos', 'warning');
		}
	}

	function selectEval(evalItem: Eval) {
		selectedEval = evalItem;
		evalModal?.close();
		showToast(`Evaluación "${evalItem.name}" seleccionada`, 'success');
	}

	// Limpiar URLs al desmontar
	$effect(() => () => currentPreview && URL.revokeObjectURL(currentPreview));
</script>

<PageTitle title="Proceso de verificacion" description="Procesa hojas de respuestas con OMR">
	<button
		class="w-full bg-base-200 hover:bg-base-300 transition-all duration-300 rounded-lg"
		onclick={openEvalModal}
		aria-label="Seleccionar evaluación"
	>
		<div class="p-4 text-center">
			{#if selectedEval}
				<div class="badge badge-primary badge-outline mb-2">
					{data.levels.find((l: Level) => l.code === selectedEval?.level_code)?.name}
				</div>
				<span class="block font-bold text-lg">{selectedEval.name}</span>
				<span class="block text-sm opacity-70">
					Grupo {selectedEval.group_name} • {formatDate(selectedEval.eval_date)}
				</span>
			{:else}
				<span class="block p-5">Seleccionar evaluación</span>
			{/if}
		</div>
	</button>
</PageTitle>

<main class="flex flex-col h-full gap-6 p-4">
	<!-- Barra de herramientas -->
	<section class="card bg-base-200/80 shadow">
		<div class="card-body p-6">
			<div class="flex gap-2">
				<label class="btn btn-primary btn-outline">
					Cargar Respuestas
					<input type="file" accept="image/*" multiple class="hidden" onchange={handleFileUpload} />
				</label>
				<button
					class="btn btn-error btn-outline"
					disabled={!uploadedFiles.length}
					onclick={clearFiles}
				>
					<Trash2 size={18} /> Limpiar
				</button>
			</div>
		</div>
	</section>

	<div class="flex flex-col lg:flex-row flex-1 gap-6">
		<!-- Panel de archivos -->
		<section class="w-full lg:w-1/3 card bg-base-200/80 shadow">
			<div class="card-body p-6">
				<header class="flex items-center justify-between mb-4">
					<h3 class="card-title">Archivos</h3>
					<div class="flex items-center gap-2">
						<span class="badge badge-primary badge-outline">{uploadedFiles.length}</span>
						<button
							class="btn btn-secondary btn-sm gap-1"
							disabled={!uploadedFiles.length}
							onclick={verifyFiles}
						>
							<CheckCircle2 size={16} /> Verificar
						</button>
					</div>
				</header>
				<div class="overflow-x-auto rounded-lg bg-base-200/80">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th>Nombre</th>
								<th>Estado</th>
								<th class="text-right">Acción</th>
							</tr>
						</thead>
						<tbody>
							{#each uploadedFiles as file, index (index)}
								<tr
									class="hover:bg-base-200 cursor-pointer {selectedFileIndex === index
										? 'bg-primary-100'
										: ''}"
									onclick={() => (selectedFileIndex = index)}
								>
									<td class="truncate max-w-[150px]" title={file.name}>
										{file.name}
										<div class="text-xs opacity-70">
											✅ Nombre del estudiante: <b>
												<!-- TODO: get from omr result and api to implement -->
											</b>
										</div>
									</td>
									<td>
										<!-- Existen 3 estados: 1, pendiente, verificado, procesado -->
										{#if verifiedFiles[index]}
											<span class="badge badge-success gap-1"><Check size={12} /> OK</span>
										{:else}
											<span class="badge badge-warning gap-1">
												<AlertCircle size={12} /> Pendiente
											</span>
										{/if}
									</td>
									<td class="text-right">
										<button class="btn btn-ghost btn-xs" onclick={() => removeFile(index)}>
											<X size={16} />
										</button>
									</td>
								</tr>
							{:else}
								<tr><td colspan="3" class="text-center py-8 opacity-50">Sin archivos</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</section>

		<!-- Previsualización -->
		<section class="flex-1 card bg-base-200/80 shadow">
			<div class="card-body p-6">
				<header class="flex items-center justify-between mb-4 overflow-x-auto">
					<h3 class="card-title">Previsualización</h3>
					{#if currentPreview}
						<div class="flex gap-2">
							<span class="badge badge-success gap-2">
								<Check size={14} />
								{selectedFileIndex + 1}/{uploadedFiles.length}
							</span>
							<span
								class="badge {verifiedFiles[selectedFileIndex] ? 'badge-success' : 'badge-warning'}"
							>
								{verifiedFiles[selectedFileIndex] ? 'Verificado' : 'Pendiente'}
							</span>
						</div>
					{/if}
				</header>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="relative flex-1 flex items-center justify-center bg-base-100 rounded-lg p-6 min-h-[400px]"
					onmousemove={handleDrag}
					onmouseup={endDrag}
					onmouseleave={endDrag}
					aria-roledescription="Área de selección"
				>
					<div class="relative max-w-full max-h-[65vh]">
						{#if currentPreview}
							<img
								src={currentPreview}
								alt="Previsualización"
								class="max-w-full max-h-[65vh] object-contain rounded-lg"
								bind:this={imageRef}
							/>
							{#if absoluteRect}
								<div
									class="absolute border-2 border-primary bg-primary/10"
									style="top: {absoluteRect.top}px; left: {absoluteRect.left}px; width: {absoluteRect.width}px; height: {absoluteRect.height}px;"
								>
									<button
										class="absolute -top-2 -left-2 w-4 h-4 bg-primary rounded-full cursor-nw-resize"
										onmousedown={(e) => startDrag(e, 'topLeft')}
										aria-label="Ajustar esquina superior izquierda"
									></button>
									<button
										class="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full cursor-ne-resize"
										onmousedown={(e) => startDrag(e, 'topRight')}
										aria-label="Ajustar esquina superior derecha"
									></button>
									<button
										class="absolute -bottom-2 -left-2 w-4 h-4 bg-primary rounded-full cursor-sw-resize"
										onmousedown={(e) => startDrag(e, 'bottomLeft')}
										aria-label="Ajustar esquina inferior izquierda"
									></button>
									<button
										class="absolute -bottom-2 -right-2 w-4 h-4 bg-primary rounded-full cursor-se-resize"
										onmousedown={(e) => startDrag(e, 'bottomRight')}
										aria-label="Ajustar esquina inferior derecha"
									></button>
								</div>
							{/if}
						{:else}
							<div class="text-center opacity-50 space-y-4">
								<Upload size={48} class="mx-auto" />
								<p>Selecciona un archivo</p>
							</div>
						{/if}
					</div>
				</div>
				<footer class="flex justify-between mt-6">
					<p class="text-sm opacity-70">{currentPreview ? 'Ajusta el área de detección' : ''}</p>
					<button
						class="btn btn-primary gap-2"
						disabled={!selectedEval || !uploadedFiles.length}
						onclick={processFiles}
					>
						<Play size={20} /> Procesar
					</button>
				</footer>
			</div>
		</section>
	</div>
</main>

<!-- Modal -->
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
		<div class="bg-base-100 rounded-xl p-4 mb-6">
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
		<div class="overflow-x-auto rounded-lg bg-base-200">
			<table class="table">
				<thead>
					<tr>
						<th>Nombre</th>
						<th class="text-center">Grupo</th>
						<th class="text-center">Fecha</th>
					</tr>
				</thead>
				<tbody>
					{#each evaluations as item (item.code)}
						<tr class="hover:bg-base-300 cursor-pointer" onclick={() => selectEval(item)}>
							<td>{item.name}</td>
							<td class="text-center"><span class="badge badge-ghost">{item.group_name}</span></td>
							<td class="text-center text-sm opacity-70">{formatDate(item.eval_date)}</td>
						</tr>
					{:else}
						<tr><td colspan="3" class="text-center py-8 opacity-50">Sin evaluaciones</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
