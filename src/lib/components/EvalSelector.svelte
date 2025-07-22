<script lang="ts">
	import { X, School, BookOpen, Search } from 'lucide-svelte';
	import type { Levels, EvalWithSections } from '$lib/types';
	import { formatDate } from '$lib/utils/formatDate';
	import { onMount } from 'svelte';

	type Props = {
		levels: Levels[];
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

	// Filtered and sorted evaluations based on search query (most recent first)
	const filteredEvals = $derived.by(() => {
		let evals = [...availableEvals]; // Create a copy to avoid mutation

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			evals = evals.filter(
				(evalItem) =>
					evalItem.name.toLowerCase().includes(query) ||
					evalItem.group_name.toLowerCase().includes(query)
			);
		}

		// Sort by creation date (most recent first)
		return evals.sort((a, b) => {
			const dateA = new Date(a.created_at || a.eval_date);
			const dateB = new Date(b.created_at || b.eval_date);
			return dateB.getTime() - dateA.getTime();
		});
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
	<div class="modal-box max-w-4xl">
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-xl font-bold flex items-center gap-2">
				<School class="w-5 h-5" />
				Seleccionar Evaluación
			</h3>
			<button class="btn btn-sm btn-circle btn-ghost" onclick={closeModal}>
				<X size={18} />
			</button>
		</div>

		<div class="space-y-4">
			<!-- Controls -->
			<div class="card bg-base-200">
				<div class="card-body p-4">
					<div class="flex flex-wrap gap-4">
						<!-- Level selector -->
						<div class="flex-1 min-w-64">
							<label class="label">
								<span class="label-text flex items-center gap-2">
									<BookOpen class="w-4 h-4" />
									Nivel Académico
								</span>
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

						<!-- Search input -->
						{#if selectedLevelCode && !loading}
							<div class="flex-1 min-w-64">
								<label class="label">
									<span class="label-text flex items-center gap-2">
										<Search class="w-4 h-4" />
										Buscar Evaluación
									</span>
								</label>
								<input
									type="text"
									placeholder="Buscar por nombre o grupo..."
									class="input input-bordered w-full"
									bind:value={searchQuery}
								/>
							</div>
						{/if}
					</div>
				</div>
			</div>
			{#if selectedLevelCode}
				{#if loading}
					<div class="flex flex-col items-center justify-center py-12">
						<span class="loading loading-spinner loading-lg mb-4"></span>
						<p class="text-base-content/60">Cargando evaluaciones...</p>
					</div>
				{:else}
					<div class="card bg-base-100">
						<div class="card-body p-0">
							<div class="max-h-96 overflow-y-auto">
								<table class="table table-zebra">
									<thead>
										<tr>
											<th>
												<div class="flex items-center gap-2">
													<School class="w-4 h-4" />
													Evaluación
												</div>
											</th>
											<th class="text-center">Grupo</th>
											<th class="text-center">Fecha</th>
											<th class="text-center">Acción</th>
										</tr>
									</thead>
									<tbody>
										{#each filteredEvals as item (item.code)}
											<tr>
												<td>{item.name}</td>
												<td class="text-center">
													<span class="badge badge-outline badge-sm">{item.group_name}</span>
												</td>
												<td class="text-center">
													<span class="text-xs text-base-content/70">
														{formatDate(String(item.eval_date))}
													</span>
												</td>
												<td class="text-center">
													<button
														class="btn btn-sm {selectedEval?.code === item.code
															? 'btn-success'
															: 'btn-primary'}"
														onclick={() => {
															onSelectEval(item);
															closeModal();
														}}
														disabled={selectedEval?.code === item.code || loading}
													>
														{#if selectedEval?.code === item.code}
															✓ Seleccionado
														{:else}
															Seleccionar
														{/if}
													</button>
												</td>
											</tr>
										{:else}
											<tr>
												<td colspan="4" class="text-center py-12">
													<div class="flex flex-col items-center gap-3">
														<Search class="w-8 h-8 text-base-content/30" />
														<div class="text-center">
															<h4 class="font-semibold text-base-content/70">
																{searchQuery ? 'Sin resultados' : 'No hay evaluaciones'}
															</h4>
															<p class="text-sm text-base-content/50">
																{searchQuery
																	? `No se encontraron evaluaciones que coincidan con "${searchQuery}"`
																	: 'No hay evaluaciones disponibles para este nivel'}
															</p>
														</div>
													</div>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				{/if}
			{:else}
				<!-- No level selected state -->
				<div class="card bg-base-100">
					<div class="card-body">
						<div class="flex flex-col items-center justify-center py-12 space-y-4">
							<School class="w-12 h-12 text-info" />
							<div class="text-center space-y-2">
								<h4 class="text-lg font-semibold">Selecciona un nivel académico</h4>
								<p class="text-base-content/70">
									Elige un nivel para ver las evaluaciones disponibles
								</p>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>cerrar</button></form>
</dialog>
