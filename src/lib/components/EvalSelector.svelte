<script lang="ts">
	import { X, School, BookOpen, Search } from 'lucide-svelte';
	import type { Level, EvalWithSections } from '$lib/types';
	import { formatDate } from '$lib/utils/formatDate';
	import { onMount } from 'svelte';

	type Props = {
		levels: Level[];
		availableEvals: EvalWithSections[];
		selectedEval: EvalWithSections | null;
		selectedLevelCode: string;
		open?: boolean;
		loading?: boolean;
		/** Función que se llama cuando el modal se cierra (ya sea por selección o por cancelación) */
		onClose?: () => void;
		onLevelChange?: (levelCode: string) => void;
		/** Función que se llama cuando se selecciona una evaluación */
		onSelectEval?: (evalItem: EvalWithSections) => void;
	};

	const {
		levels = [],
		availableEvals = [],
		selectedEval = null,
		selectedLevelCode = '',
		open = false,
		loading = false,
		onClose = () => {},
		onLevelChange = () => {},
		onSelectEval = () => {}
	}: Props = $props();

	let modal = $state<HTMLDialogElement | null>(null);
	let searchQuery = $state('');

	// Filtered evaluations based on search query
	const filteredEvals = $derived(() => {
		if (!searchQuery.trim()) return availableEvals;

		const query = searchQuery.toLowerCase().trim();
		return availableEvals.filter(
			(evalItem) =>
				evalItem.name.toLowerCase().includes(query) ||
				evalItem.group_name.toLowerCase().includes(query)
		);
	});

	// Modal control
	$effect(() => {
		if (open && modal && !modal.open) {
			modal.showModal();
		} else if (!open && modal?.open) {
			modal.close();
		}
	});

	// Close event handling - notifica al componente padre cuando el modal se cierra
	onMount(() => {
		const modalElement = modal;
		if (!modalElement) return;

		const handleClose = () => onClose();
		modalElement.addEventListener('close', handleClose);
		return () => modalElement.removeEventListener('close', handleClose);
	});

	function closeModal() {
		modal?.close();
	}

	function handleLevelChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		searchQuery = ''; // Clear search when level changes
		onLevelChange(target.value);
	}
</script>

<dialog bind:this={modal} class="modal">
	<div class="modal-box">
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-xl font-bold text-primary flex items-center gap-2">
				<School class="w-6 h-6" /> Seleccionar Evaluación
			</h3>
			<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={closeModal}>
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
					value={selectedLevelCode}
					onchange={handleLevelChange}
					disabled={loading}
				>
					<option value="">Elige un nivel</option>
					{#each levels as level (level.code)}
						<option value={level.code}>{level.name}</option>
					{/each}
				</select>
			</div>
			{#if selectedLevelCode}
				{#if loading}
					<div class="flex justify-center my-8">
						<span class="loading loading-spinner loading-md text-primary"></span>
					</div>
				{:else}
					<div class="mb-4">
						<label class="label font-semibold flex items-center gap-2">
							<Search class="w-5 h-5 text-secondary" /> Buscar Evaluación
						</label>
						<input
							type="text"
							placeholder="Buscar por nombre o grupo..."
							class="input input-bordered w-full pl-10"
							bind:value={searchQuery}
						/>
					</div>
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
								{#each filteredEvals() as item (item.code)}
									<tr class="hover">
										<td class="font-medium whitespace-nowrap">{item.name}</td>
										<td class="text-center">
											<span class="badge badge-ghost badge-sm">{item.group_name}</span>
										</td>
										<td class="text-center text-xs opacity-70">{formatDate(item.eval_date)}</td>
										<td class="text-center">
											<button
												class="btn btn-primary btn-xs"
												onclick={() => {
													onSelectEval(item);
													closeModal();
												}}
												disabled={selectedEval?.code === item.code || loading}
											>
												{selectedEval?.code === item.code ? 'Seleccionado' : 'Seleccionar'}
											</button>
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="4" class="text-center py-6 opacity-50">
											{searchQuery
												? 'No se encontraron evaluaciones que coincidan con la búsqueda.'
												: 'No hay evaluaciones para este nivel.'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/if}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>cerrar</button></form>
</dialog>
