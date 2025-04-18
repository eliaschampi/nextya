<script lang="ts">
	import type { ApiOmrErrorData, ApiOmrSuccessData } from '$lib/types/api';

	// Definición local de FileEntry para incluir propiedades de formato
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
	import { Play, X, Loader2, Eye, Edit, Check, AlertCircle } from 'lucide-svelte';

	type Props = {
		entries: FileEntry[];
		selectedId: string | null;
		processingId: string | null;
		validationErrorsMap: Map<string, string>;
		evalSelected: boolean;
		onSelect: (id: string) => void;
		onProcess: (id: string, rollCode?: string) => void;
		onRemove: (id: string) => void;
		onViewDetails: (id: string) => void;
		onUpdateRollCode: (id: string, newRollCode: string) => void;
	};

	// Constants for score thresholds
	const SCORE_THRESHOLD_SUCCESS = 14;
	const SCORE_THRESHOLD_WARNING = 10.5;
	const ROLL_CODE_PATTERN = /^\d{4}$/;

	const {
		entries = [],
		selectedId = null,
		processingId = null,
		validationErrorsMap = new Map(),
		evalSelected = false,
		onSelect = () => {},
		onProcess = () => {},
		onRemove = () => {},
		onViewDetails = () => {},
		onUpdateRollCode = () => {}
	}: Props = $props();

	let editingId = $state<string | null>(null);
	let editedRollCode = $state('');

	function startEditing(id: string, initialCode: string, event: MouseEvent) {
		event.stopPropagation();
		if (editingId !== null) return;
		editingId = id;
		editedRollCode = initialCode;
	}

	function confirmEdit(id: string, event: Event) {
		event.stopPropagation();
		if (editedRollCode && ROLL_CODE_PATTERN.test(editedRollCode)) {
			onUpdateRollCode(id, editedRollCode);
		}
		editingId = null;
		editedRollCode = '';
	}

	function cancelEdit(event: Event) {
		event.stopPropagation();
		editingId = null;
		editedRollCode = '';
	}

	function getStatusIcon(entry: FileEntry): typeof AlertCircle {
		// Simplificado a 3 estados principales: carga, error, éxito

		// Estado de carga
		if (entry.id === processingId || entry.status === 'processing') {
			return Loader2;
		}

		// Estados de error
		if (
			validationErrorsMap.has(entry.id) ||
			entry.formatValid === false ||
			entry.status === 'error' ||
			(entry.status === 'success' && !entry.result?.register_code)
		) {
			return AlertCircle;
		}

		// Estado de éxito
		if (entry.status === 'success') {
			return Check;
		}

		// Estado pendiente (default)
		return AlertCircle;
	}

	function getStatusColor(entry: FileEntry): string {
		// Simplificado a 3 colores principales: carga, error, éxito

		// Estado de carga
		if (entry.id === processingId || entry.status === 'processing') {
			return 'text-info animate-spin';
		}

		// Estados de error
		if (
			validationErrorsMap.has(entry.id) ||
			entry.formatValid === false ||
			entry.status === 'error'
		) {
			return 'text-error';
		}

		// Estado de advertencia (estudiante no encontrado)
		if (entry.status === 'success' && !entry.result?.register_code) {
			return 'text-warning';
		}

		// Estado de éxito
		if (entry.status === 'success') {
			return 'text-success';
		}

		// Estado pendiente (default)
		return 'text-base-content/50';
	}

	function getScoreDisplay(entry: FileEntry): { text: string; class: string } {
		if (entry.status === 'success' && entry.result?.scores?.general) {
			const score = entry.result.scores.general.score;
			let colorClass = 'text-error';
			if (score >= SCORE_THRESHOLD_SUCCESS) colorClass = 'text-success';
			else if (score >= SCORE_THRESHOLD_WARNING) colorClass = 'text-warning';
			return { text: score.toFixed(1), class: `font-bold ${colorClass}` };
		}
		return { text: '-', class: 'text-base-content/50' };
	}

	function getTooltip(entry: FileEntry): string | null {
		// Prioridad 1: Errores de validación del sistema
		if (validationErrorsMap.has(entry.id)) return validationErrorsMap.get(entry.id)!;

		// Prioridad 2: Error de formato A5
		if (entry.formatValid === false) {
			return `Formato no A5: ${entry.formatName || 'Proporción incorrecta'}. Recorta la imagen primero.`;
		}

		// Otros estados
		if (entry.status === 'error') return entry.error?.message ?? 'Error desconocido';
		if (entry.status === 'success' && !entry.result?.register_code)
			return `Estudiante con código ${entry.result?.roll_code} no encontrado en registros.`;
		if (entry.saved) return 'Resultado guardado en la base de datos.';
		if (entry.status === 'pending') return 'Pendiente de procesamiento.';
		if (entry.id === processingId || entry.status === 'processing') return 'Procesando...';
		if (entry.status === 'success') return 'Procesado correctamente.';
		return null;
	}
</script>

{#snippet statusIcon(entry: FileEntry)}
	{@const Icon = getStatusIcon(entry)}
	{@const statusColor = getStatusColor(entry)}
	{@const tooltip = getTooltip(entry)}
	<span class="tooltip tooltip-right" data-tip={tooltip}>
		<Icon size={16} class={statusColor} />
	</span>
{/snippet}
{#snippet rollCodeEditor(entry: FileEntry)}
	<div class="join h-7">
		<input
			type="text"
			class="join-item input input-bordered input-xs w-16 px-2 font-mono {editedRollCode &&
			!ROLL_CODE_PATTERN.test(editedRollCode)
				? 'input-error'
				: 'input-primary'}"
			bind:value={editedRollCode}
			pattern="\d{4}"
			maxlength="4"
			placeholder="0000"
			aria-label="Editar código de matrícula"
		/>
		<button
			class="join-item btn btn-primary btn-xs btn-square"
			onclick={(e) => confirmEdit(entry.id, e)}
			disabled={!editedRollCode || !ROLL_CODE_PATTERN.test(editedRollCode)}
			title="Confirmar y Reprocesar"
			aria-label="Confirmar y Reprocesar código"
		>
			<Check size={14} />
		</button>
		<button
			class="join-item btn btn-ghost btn-xs btn-square"
			onclick={cancelEdit}
			title="Cancelar edición"
			aria-label="Cancelar edición de código"
		>
			<X size={14} />
		</button>
	</div>
{/snippet}
{#snippet rollCodeDisplay(entry: FileEntry, isBusy: boolean)}
	<div class="flex items-center gap-1 h-7">
		{#if entry.result?.roll_code || entry.error?.roll_code}
			<code>
				{entry.result?.roll_code || entry.error?.roll_code}
			</code>
			<button
				class="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-primary"
				onclick={(e) =>
					startEditing(entry.id, entry.result?.roll_code || entry.error?.roll_code || '', e)}
				title="Editar código y reprocesar"
				aria-label="Editar código y reprocesar"
				disabled={isBusy}
			>
				<Edit size={12} />
			</button>
		{:else if entry.status === 'pending' || (entry.status === 'error' && !entry.error?.roll_code)}
			<button
				class="btn btn-outline btn-xs btn-primary"
				onclick={(e) => startEditing(entry.id, '', e)}
				disabled={isBusy}
				title="Especificar código de 4 dígitos para procesar"
				aria-label="Asignar código de matrícula"
			>
				<Edit size={12} class="mr-0.5" /> Asignar
			</button>
		{:else}
			<span class="text-xs opacity-50">-</span>
		{/if}
	</div>
{/snippet}
<div class="max-h-[50rem] overflow-auto rounded-lg bg-base-200/50">
	<table class="table table-sm table-zebra table-pin-rows w-full">
		<thead>
			<tr>
				<th class="w-10"></th>
				<th>Archivo</th>
				<th>Código</th>
				<th>Estudiante</th>
				<th class="text-center">Nota</th>
				<th class="text-right pr-4">Acciones</th>
			</tr>
		</thead>
		<tbody>
			{#each entries as entry (entry.id)}
				{@const scoreInfo = getScoreDisplay(entry)}
				{@const isProcessing = entry.id === processingId || entry.status === 'processing'}
				{@const isEditingOther = editingId !== null && editingId !== entry.id}
				{@const isBusy = isProcessing || isEditingOther}
				<tr
					class={['cursor-pointer hover:bg-primary/10', selectedId === entry.id && 'bg-primary/10']}
					onclick={() => onSelect(entry.id)}
				>
					<td class="text-center pl-2">
						{@render statusIcon(entry)}
					</td>
					<td class="truncate max-w-[10rem] py-2.5" title={entry.file.name}>
						{entry.file.name}
					</td>
					<td class="font-mono text-sm">
						{#if editingId === entry.id}
							{@render rollCodeEditor(entry)}
						{:else}
							{@render rollCodeDisplay(entry, isBusy)}
						{/if}
					</td>
					<td class="truncate max-w-xs text-sm">
						{#if entry.result?.student}
							<span
								class="flex items-center gap-1.5"
								title={`${entry.result.student.name} ${entry.result.student.last_name}`}
							>
								<Check size={14} class="text-success flex-shrink-0" />
								{entry.result.student.name}
								{entry.result.student.last_name}
							</span>
						{:else if entry.status === 'success' && entry.result && !entry.result.student}
							<span
								class="flex items-center gap-1.5 text-warning"
								title={`Estudiante ${entry.result.roll_code} no encontrado`}
							>
								No encontrado
							</span>
						{:else}
							<span class="text-xs opacity-50">-</span>
						{/if}
					</td>
					<td class="text-center">
						<span class={scoreInfo.class}>{scoreInfo.text}</span>
					</td>
					<td class="text-right pr-4">
						<div class="flex gap-1 justify-end items-center h-7">
							{#if (entry.status === 'pending' || entry.status === 'error') && editingId !== entry.id}
								<button
									class="btn btn-xs tooltip btn-primary"
									onclick={() => onProcess(entry.id)}
									disabled={!evalSelected || isBusy || entry.formatValid === false}
									data-tip={entry.formatValid === false
										? 'Formato no A5. Recorta la imagen primero.'
										: 'Procesar'}
								>
									{#if isProcessing}
										<Loader2 size={14} class="animate-spin" />
									{:else}
										<Play size={14} />
									{/if}
								</button>
							{/if}
							{#if entry.status === 'success'}
								<button
									class="btn btn-ghost btn-xs btn-square"
									onclick={() => onViewDetails(entry.id)}
									title="Ver detalles de respuestas"
									aria-label="Ver detalles de respuestas"
									disabled={isEditingOther}
								>
									<Eye size={14} />
								</button>
							{/if}
							<button
								class="btn btn-ghost btn-error btn-xs btn-square"
								onclick={() => onRemove(entry.id)}
								disabled={isBusy}
								title="Eliminar archivo"
								aria-label="Eliminar archivo"
							>
								<X size={14} />
							</button>
						</div>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="6" class="text-center py-8 opacity-50">
						No hay archivos cargados. Añade imágenes para comenzar.
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
