<script lang="ts">
	import {
		Play,
		X,
		Loader2,
		Eye,
		Edit,
		Save,
		Check,
		AlertCircle,
		Info,
		RefreshCw
	} from 'lucide-svelte';
	import type { OmrProcessedResult } from '$lib/types/omrProcessing';

	const {
		files = [],
		processedResults = {},
		selectedIndex = -1,
		isProcessing = false,
		processingIndex = -1,
		isSaving = false,
		savingIndex = -1,
		evalSelected = false,
		onSelect = () => {},
		onProcess = () => {},
		onRemove = () => {},
		onViewDetails = () => {},
		onSave = () => {},
		onReprocess = () => {}
	} = $props<{
		files: File[];
		processedResults: Record<number, OmrProcessedResult>;
		selectedIndex: number;
		isProcessing: boolean;
		processingIndex: number;
		isSaving: boolean;
		savingIndex: number;
		evalSelected: boolean;
		onSelect?: (index: number) => void;
		onProcess?: (index: number) => void;
		onRemove?: (index: number) => void;
		onViewDetails?: (index: number) => void;
		onSave?: (index: number) => void;
		onReprocess?: (index: number, rollCode: string) => void;
	}>();

	// Local state for editing student codes
	let editingIndex = $state<number | null>(null);
	let editedRollCode = $state('');
	// Flag to indicate if we're editing before processing
	let preProcessEdit = $state<number | null>(null);

	// Start editing a student code
	function startEditing(index: number, event: MouseEvent) {
		event.stopPropagation();
		editingIndex = index;
		// If the file hasn't been processed yet, mark it as pre-process edit
		if (!processedResults[index] || processedResults[index]?.status === 'error') {
			preProcessEdit = index;
		}
		editedRollCode =
			processedResults[index]?.studentCode || processedResults[index]?.detectedCode || '';
	}

	// Save edited student code
	function saveEditing(index: number, event: MouseEvent) {
		event.stopPropagation();
		if (editedRollCode && /^\d{4}$/.test(editedRollCode)) {
			// If we're editing before processing, we'll use this code when processing
			if (preProcessEdit === index) {
				// Process with the manually entered code
				onProcess(index, editedRollCode);
				preProcessEdit = null;
			} else {
				// Reprocess with the new code
				onReprocess(index, editedRollCode);
			}
		}
		editingIndex = null;
	}

	// Cancel editing
	function cancelEditing(event: MouseEvent) {
		event.stopPropagation();
		editingIndex = null;
		preProcessEdit = null;
	}

	// Format score with color
	function getScoreClass(score: number): string {
		if (score >= 7) return 'text-success';
		if (score >= 4) return 'text-warning';
		return 'text-error';
	}

	// Get code status class
	/* function getCodeStatusClass(result: OmrProcessedResult | undefined): string {
		if (!result) return '';
		if (result.status === 'error' && result.errorType === 'invalid_roll_code') return 'text-error';
		if (!result.student) return 'text-warning';
		return 'text-primary';
	} */
</script>

<div class="overflow-x-auto rounded-lg bg-base-200/80">
	<table class="table table-zebra table-sm">
		<thead>
			<tr>
				<th>Archivo</th>
				<th>Código</th>
				<th>Estudiante</th>
				<th class="text-center">Nota</th>
				<th class="text-right">Acciones</th>
			</tr>
		</thead>
		<tbody>
			{#each files as file, index (index)}
				<tr
					class="hover:bg-base-200 cursor-pointer {selectedIndex === index
						? 'bg-primary/10 border-l-4 border-primary'
						: ''}"
					onclick={() => onSelect(index)}
				>
					<!-- Nombre del archivo -->
					<td class="truncate max-w-[150px]" title={file.name}>
						<div class="flex items-center gap-2">
							<!-- Indicador de estado -->
							{#if isProcessing && processingIndex === index}
								<Loader2 size={14} class="text-info animate-spin" />
							{:else if processedResults[index]?.status === 'success'}
								<Check size={14} class="text-success" />
							{:else if processedResults[index]?.status === 'error'}
								<AlertCircle size={14} class="text-error" />
							{:else if preProcessEdit === index}
								<div class="w-3.5 h-3.5 rounded-full bg-primary animate-pulse"></div>
							{:else}
								<div class="w-3.5 h-3.5 rounded-full bg-warning/50"></div>
							{/if}
							<span class="font-medium">{file.name}</span>
						</div>
					</td>

					<!-- Código de estudiante -->
					<td>
						{#if editingIndex === index}
							<div class="join">
								<input
									type="text"
									class="join-item input input-bordered input-xs w-16 {!editedRollCode ||
									!/^\d{4}$/.test(editedRollCode)
										? 'input-error'
										: ''}"
									bind:value={editedRollCode}
									pattern="\d{4}"
									maxlength="4"
									placeholder="Código"
									onclick={(e) => e.stopPropagation()}
								/>
								<button
									class="join-item btn btn-primary btn-xs btn-square"
									onclick={(e) => saveEditing(index, e)}
									disabled={!editedRollCode || !/^\d{4}$/.test(editedRollCode)}
									title={preProcessEdit === index
										? 'Procesar con este código'
										: 'Actualizar código'}
								>
									<Save size={12} />
								</button>
								<button class="join-item btn btn-ghost btn-xs btn-square" onclick={cancelEditing}>
									<X size={12} />
								</button>
							</div>
						{:else if !processedResults[index] && preProcessEdit !== index}
							<!-- Opción para ingresar código antes de procesar -->
							<div class="flex items-center gap-1">
								<button
									class="btn btn-outline btn-xs btn-primary"
									onclick={(e) => startEditing(index, e)}
									disabled={isProcessing}
									title="Especificar código antes de procesar"
								>
									<Edit size={12} class="mr-1" /> Especificar código
								</button>
							</div>
						{:else}
							<div class="flex items-center gap-1">
								{#if processedResults[index]}
									<div
										class="badge badge-sm font-mono {processedResults[index].errorType ===
										'invalid_roll_code'
											? 'badge-error'
											: processedResults[index].student
												? 'badge-primary'
												: 'badge-warning'}"
									>
										{processedResults[index].studentCode ||
											processedResults[index].detectedCode ||
											'N/A'}
									</div>
									{#if processedResults[index].detectedCode && processedResults[index].detectedCode !== processedResults[index].studentCode}
										<div class="text-xs opacity-70">
											(Detectado: {processedResults[index].detectedCode})
										</div>
									{/if}
									<button
										class="btn btn-ghost btn-xs btn-square"
										onclick={(e) => startEditing(index, e)}
										title="Editar código"
									>
										<Edit size={12} />
									</button>
								{:else if preProcessEdit === index}
									<div class="badge badge-sm badge-primary font-mono animate-pulse">
										{editedRollCode || 'Pendiente'}
									</div>
								{:else}
									<span class="text-xs opacity-50">Pendiente</span>
								{/if}
							</div>
						{/if}
					</td>

					<!-- Nombre del estudiante -->
					<td>
						{#if processedResults[index]?.status === 'success' && processedResults[index]?.student}
							<span class="text-sm truncate max-w-32">
								{processedResults[index].student.name}
								{processedResults[index].student.lastName}
							</span>
						{:else if processedResults[index]?.status === 'error'}
							<div
								class="tooltip tooltip-right"
								data-tip={processedResults[index].message || 'Error desconocido'}
							>
								<span class="text-xs text-error flex items-center gap-1">
									<Info size={12} />
									{processedResults[index].errorType === 'invalid_roll_code'
										? 'Código inválido'
										: 'Error'}
								</span>
							</div>
						{:else if processedResults[index]?.validationStatus?.message}
							<div
								class="tooltip tooltip-right"
								data-tip={processedResults[index].validationStatus.message}
							>
								<span class="text-xs text-warning flex items-center gap-1">
									<Info size={12} /> No encontrado
								</span>
							</div>
						{:else if preProcessEdit === index}
							<span class="text-xs opacity-70">Pendiente de procesar</span>
						{:else}
							<span class="text-xs opacity-50">-</span>
						{/if}
					</td>

					<!-- Nota -->
					<td class="text-center">
						{#if processedResults[index]?.status === 'success' && processedResults[index]?.results}
							<span class="font-bold {getScoreClass(processedResults[index].results.totalScore)}">
								{processedResults[index].results.totalScore.toFixed(1)}
							</span>
						{:else if preProcessEdit === index}
							<span class="text-xs opacity-70">Pendiente</span>
						{:else}
							<span class="text-xs opacity-50">-</span>
						{/if}
					</td>

					<!-- Acciones -->
					<td class="text-right">
						<div class="flex gap-1 justify-end">
							{#if !processedResults[index] || processedResults[index]?.status === 'error'}
								<!-- Botón de procesar solo si no estamos en modo edición previa -->
								{#if preProcessEdit !== index}
									<button
										class="btn btn-primary btn-xs"
										onclick={(e) => {
											e.stopPropagation();
											onProcess(index);
										}}
										disabled={isProcessing || !evalSelected}
										title={!evalSelected ? 'Seleccione una evaluación primero' : 'Procesar'}
									>
										{#if isProcessing && processingIndex === index}
											<Loader2 size={14} class="animate-spin" />
										{:else}
											<Play size={14} />
										{/if}
									</button>
								{/if}
							{/if}

							<!-- Botón de reprocesar si hubo error pero no es de código inválido -->
							{#if processedResults[index]?.status === 'error' && processedResults[index]?.errorType !== 'invalid_roll_code'}
								<button
									class="btn btn-warning btn-xs"
									onclick={(e) => {
										e.stopPropagation();
										onProcess(index);
									}}
									disabled={isProcessing || !evalSelected}
									title="Reintentar procesamiento"
								>
									<RefreshCw size={14} />
								</button>
							{/if}

							<!-- Botón de ver detalles siempre visible si hay resultados -->
							{#if processedResults[index]?.status === 'success'}
								<button
									class="btn btn-ghost btn-xs"
									onclick={(e) => {
										e.stopPropagation();
										onViewDetails(index);
									}}
									title="Ver detalles"
								>
									<Eye size={14} />
								</button>
							{/if}

							<!-- Botón de guardar solo si hay estudiante y no está guardado -->
							{#if processedResults[index]?.status === 'success' && processedResults[index]?.student && !processedResults[index]?.saved}
								<button
									class="btn btn-primary btn-xs"
									onclick={(e) => {
										e.stopPropagation();
										onSave(index);
									}}
									disabled={isSaving && savingIndex === index}
									title="Guardar resultado"
								>
									{#if isSaving && savingIndex === index}
										<span class="loading loading-spinner loading-xs"></span>
									{:else}
										<Save size={14} />
									{/if}
								</button>
							{/if}

							<!-- Indicador de guardado -->
							{#if processedResults[index]?.saved}
								<span class="badge badge-sm badge-success gap-1">
									<Check size={12} /> Guardado
								</span>
							{/if}

							<button
								class="btn btn-ghost btn-xs"
								onclick={(e) => {
									e.stopPropagation();
									onRemove(index);
								}}
								disabled={isProcessing && processingIndex === index}
							>
								<X size={14} />
							</button>
						</div>
					</td>
				</tr>
			{:else}
				<tr><td colspan="5" class="text-center py-8 opacity-50">Sin archivos</td></tr>
			{/each}
		</tbody>
	</table>
</div>
