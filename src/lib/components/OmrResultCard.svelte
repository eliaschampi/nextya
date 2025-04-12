<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Check, X, AlertCircle, Edit, Save, RefreshCw, Eye } from 'lucide-svelte';
	import type { OmrProcessedResult } from '$lib/types/omrProcessing';

	const dispatch = createEventDispatcher<{
		reprocess: { index: number; rollCode: string };
		save: { index: number; result: OmrProcessedResult };
		viewDetails: { index: number; result: OmrProcessedResult };
	}>();

	const {
		result,
		index,
		isProcessing = false,
		isSaving = false
	} = $props<{
		result: OmrProcessedResult;
		index: number;
		isProcessing?: boolean;
		isSaving?: boolean;
	}>();

	// Local state
	let editedRollCode = $state(result.studentCode || '');
	let isEditing = $state(false);

	// Start editing
	function startEditing() {
		isEditing = true;
	}

	// Save changes
	function saveChanges() {
		if (!editedRollCode || !/^\d{4}$/.test(editedRollCode)) {
			return; // Invalid roll code
		}

		if (editedRollCode !== result.studentCode) {
			// Reprocess with new roll code
			dispatch('reprocess', { index, rollCode: editedRollCode });
		}

		isEditing = false;
	}

	// Cancel editing
	function cancelEditing() {
		editedRollCode = result.studentCode || '';
		isEditing = false;
	}

	// Save result
	function saveResult() {
		dispatch('save', { index, result });
	}

	// View details
	function viewDetails() {
		dispatch('viewDetails', { index, result });
	}

	// Reprocess with current roll code
	function reprocess() {
		dispatch('reprocess', { index, rollCode: editedRollCode });
	}

	// Format score with color
	function getScoreClass(score: number): string {
		if (score >= 7) return 'text-success';
		if (score >= 4) return 'text-warning';
		return 'text-error';
	}
</script>

<div
	class="card bg-base-100 shadow-sm hover:shadow-md transition-all duration-300 border border-base-300/30"
>
	<div class="card-body p-4">
		<div class="flex flex-col gap-2">
			<!-- Header with status -->
			<div class="flex justify-between items-center">
				<h3 class="card-title text-base">
					{#if result.status === 'success'}
						<span class="badge badge-success gap-1"><Check size={12} /> Procesado</span>
					{:else}
						<span class="badge badge-error gap-1"><X size={12} /> Error</span>
					{/if}
				</h3>

				<div class="flex gap-1">
					{#if result.status === 'success' && result.student}
						<button class="btn btn-ghost btn-xs" onclick={viewDetails} title="Ver detalles">
							<Eye size={14} />
						</button>
					{/if}

					{#if result.status === 'error' || !result.student}
						<button
							class="btn btn-primary btn-xs"
							onclick={reprocess}
							disabled={isProcessing}
							title="Reprocesar"
						>
							<RefreshCw size={14} class={isProcessing ? 'animate-spin' : ''} />
						</button>
					{/if}
				</div>
			</div>

			<!-- Roll code section -->
			<div class="flex flex-col gap-1">
				<div class="text-sm font-medium">Código de estudiante:</div>
				<div class="flex items-center gap-2">
					{#if isEditing}
						<div class="join w-full">
							<input
								type="text"
								class="join-item input input-bordered input-sm w-full"
								bind:value={editedRollCode}
								pattern="\\d{4}"
								maxlength="4"
								placeholder="Código (4 dígitos)"
							/>
							<button
								class="join-item btn btn-primary btn-sm"
								onclick={saveChanges}
								disabled={!editedRollCode || !/^\d{4}$/.test(editedRollCode)}
							>
								<Save size={14} />
							</button>
							<button class="join-item btn btn-ghost btn-sm" onclick={cancelEditing}>
								<X size={14} />
							</button>
						</div>
					{:else}
						<div class="flex items-center gap-2 w-full">
							<div
								class="badge badge-lg {result.student
									? 'badge-primary'
									: 'badge-warning'} font-mono"
							>
								{result.studentCode || result.detectedCode || 'N/A'}
							</div>

							{#if result.detectedCode && result.detectedCode !== result.studentCode}
								<div class="text-xs opacity-70">
									(Detectado: {result.detectedCode})
								</div>
							{/if}

							<button
								class="btn btn-ghost btn-xs ml-auto"
								onclick={startEditing}
								title="Editar código"
							>
								<Edit size={14} />
							</button>
						</div>
					{/if}
				</div>

				<!-- Validation status -->
				{#if result.status === 'success'}
					{#if result.student}
						<div class="text-sm mt-1">
							<span class="font-medium">{result.student.name} {result.student.lastName}</span>
						</div>

						{#if result.results}
							<div class="flex gap-2 mt-1">
								<div class="badge badge-sm">
									Correctas: {result.results.correctCount}
								</div>
								<div class="badge badge-sm">
									Incorrectas: {result.results.incorrectCount}
								</div>
								<div class="badge badge-sm">
									En blanco: {result.results.blankCount}
								</div>
							</div>
							<div class="mt-1">
								<span class="text-sm">Nota: </span>
								<span class="font-bold {getScoreClass(result.results.totalScore)}">
									{result.results.totalScore.toFixed(2)}
								</span>
							</div>
						{/if}
					{:else}
						<div class="alert alert-warning py-2 mt-2 text-sm">
							<AlertCircle size={16} />
							<span>{result.validationStatus?.message || 'Estudiante no encontrado'}</span>
						</div>
					{/if}
				{:else}
					<div class="alert alert-error py-2 mt-2 text-sm">
						<AlertCircle size={16} />
						<span>{result.message || 'Error desconocido'}</span>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="card-actions justify-end mt-2">
				{#if result.status === 'success' && result.student}
					<button class="btn btn-primary btn-sm" onclick={saveResult} disabled={isSaving}>
						{#if isSaving}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<Save size={14} class="mr-1" />
						{/if}
						Guardar
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
