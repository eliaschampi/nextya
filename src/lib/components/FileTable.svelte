<script lang="ts">
	import type { FileEntry } from '$lib/types/app';
	import {
		Play,
		X,
		Loader2,
		Eye,
		Edit,
		Check,
		AlertCircle,
		UserX,
		HelpCircle,
		UserCheck,
		RefreshCw
	} from 'lucide-svelte';

	type Props = {
		entries: FileEntry[];
		selectedId: string | null;
		processingId: string | null; // ID del archivo que se está procesando individualmente (no batch)
		validationErrorsMap: Map<string, string>; // Mapa de ID -> mensaje de error de validación
		evalSelected: boolean;
		onSelect: (id: string) => void;
		onProcess: (id: string, rollCode?: string) => void; // Para procesar/reprocesar
		onRemove: (id: string) => void;
		onViewDetails: (id: string) => void;
		onUpdateRollCode: (id: string, newRollCode: string) => void; // Cuando se confirma la edición del código
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
		// Si ya hay otro en edición, no hacer nada o cancelarlo? Por ahora, solo permitir uno.
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

	function getRowClass(entry: FileEntry): string {
		let classes = 'hover:bg-primary/10 cursor-pointer';
		if (entry.id === selectedId) classes += ' bg-primary/10';
		else if (entry.saved) classes += ' opacity-70'; // Atenuar guardados
		return classes;
	}

	function getStatusIcon(entry: FileEntry): typeof AlertCircle {
		if (entry.id === processingId) return Loader2;
		if (validationErrorsMap.has(entry.id)) return AlertCircle;
		if (entry.status === 'processing') return Loader2; // Para batch
		if (entry.status === 'success' && !entry.result?.register_code) return UserX;
		if (entry.status === 'success') return Check;
		if (entry.status === 'error') return AlertCircle;
		return HelpCircle; // Pending
	}

	function getStatusColor(entry: FileEntry): string {
		const icon = getStatusIcon(entry);
		if (icon === Loader2) return 'text-info animate-spin';
		if (validationErrorsMap.has(entry.id)) return 'text-error';
		if (icon === UserX) return 'text-warning';
		if (icon === Check) return 'text-success';
		if (icon === AlertCircle) return 'text-error';
		return 'text-base-content/50'; // Pending
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
		if (validationErrorsMap.has(entry.id)) return validationErrorsMap.get(entry.id)!;
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

<div class="overflow-x-auto rounded-lg bg-base-200/50">
	<table class="table table-sm w-full">
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
				{@const Icon = getStatusIcon(entry)}
				{@const scoreInfo = getScoreDisplay(entry)}
				{@const isProcessing = entry.id === processingId || entry.status === 'processing'}
				{@const isEditingOther = editingId !== null && editingId !== entry.id}
				{@const isBusy = isProcessing || isEditingOther}
				<tr class={getRowClass(entry)} onclick={() => onSelect(entry.id)}>
					<td class="text-center pl-2">
						<span class="tooltip" data-tip={getTooltip(entry)}>
							<Icon size={16} class={getStatusColor(entry)} />
						</span>
					</td>
					<td class="truncate max-w-xs py-2.5" title={entry.file.name}>
						{entry.file.name}
					</td>
					<td class="font-mono text-sm">
						{#if editingId === entry.id}
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
									onkeydown={(e) => {
										if (e.key === 'Enter') confirmEdit(entry.id, e);
										else if (e.key === 'Escape') cancelEdit(e);
									}}
									aria-label="Editar código de matrícula"
									aria-describedby={editedRollCode && !ROLL_CODE_PATTERN.test(editedRollCode)
										? `roll-code-error-${entry.id}`
										: undefined}
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
							{#if editedRollCode && !ROLL_CODE_PATTERN.test(editedRollCode)}
								<p id={`roll-code-error-${entry.id}`} class="text-error text-xs mt-0.5">
									4 dígitos
								</p>
							{/if}
						{:else}
							<div class="flex items-center gap-1 h-7">
								{#if entry.result?.roll_code || entry.error?.roll_code}
									<code>
										{entry.result?.roll_code || entry.error?.roll_code}
									</code>
									<button
										class="btn btn-ghost btn-xs btn-square text-base-content/60 hover:text-primary"
										onclick={(e) =>
											startEditing(
												entry.id,
												entry.result?.roll_code || entry.error?.roll_code || '',
												e
											)}
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
						{/if}
					</td>
					<td class="truncate max-w-xs text-sm">
						{#if entry.result?.student}
							<span
								class="flex items-center gap-1.5"
								title={`${entry.result.student.name} ${entry.result.student.lastname}`}
							>
								<UserCheck size={14} class="text-success flex-shrink-0" />
								{entry.result.student.name}
								{entry.result.student.lastname}
							</span>
						{:else if entry.status === 'success' && entry.result && !entry.result.student}
							<span
								class="flex items-center gap-1.5 text-warning"
								title={`Estudiante ${entry.result.roll_code} no encontrado`}
							>
								<UserX size={14} class="flex-shrink-0" /> No encontrado
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
									class={`btn btn-xs tooltip ${entry.status === 'error' ? 'btn-warning' : 'btn-primary'}`}
									onclick={() => onProcess(entry.id)}
									disabled={!evalSelected || isBusy}
									data-tip={entry.status === 'error' ? 'Reintentar' : 'Procesar'}
								>
									{#if isProcessing}
										<Loader2 size={14} class="animate-spin" />
									{:else if entry.status === 'error'}
										<RefreshCw size={14} />
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
