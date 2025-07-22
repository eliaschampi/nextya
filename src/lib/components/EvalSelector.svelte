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
	const filteredEvals = $derived(() => {
		let evals = availableEvals;

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
			<h3
				class="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-3"
			>
				<div class="p-2 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg">
					<School class="w-6 h-6 text-primary" />
				</div>
				Seleccionar Evaluación
			</h3>
			<button
				class="btn btn-sm btn-circle btn-ghost hover:btn-error absolute right-3 top-3"
				onclick={closeModal}
			>
				<X size={18} />
			</button>
		</div>

		<div class="space-y-6">
			<div class="card bg-gradient-to-r from-base-200/50 to-base-100/50 border border-base-300/20">
				<div class="card-body p-4">
					<label class="font-semibold flex items-center gap-2 mb-2">
						<div class="p-1 bg-secondary/10 rounded">
							<BookOpen class="w-4 h-4 text-secondary" />
						</div>
						Nivel Académico
					</label>
					<select
						class="select select-bordered w-full bg-base-100 focus:border-primary transition-colors"
						value={selectedLevelCode}
						onchange={handleLevelChange}
						disabled={loading}
					>
						<option value="">Elige un nivel académico</option>
						{#each levels as level (level.code)}
							<option value={level.code}>{level.name}</option>
						{/each}
					</select>
				</div>
			</div>
			{#if selectedLevelCode}
				{#if loading}
					<div class="flex flex-col items-center justify-center py-12">
						<span class="loading loading-spinner loading-lg text-primary mb-4"></span>
						<p class="text-base-content/60">Cargando evaluaciones...</p>
					</div>
				{:else}
					<div
						class="card bg-gradient-to-r from-base-200/50 to-base-100/50 border border-base-300/20"
					>
						<div class="card-body p-4">
							<label class="font-semibold flex items-center gap-2 mb-2">
								<div class="p-1 bg-secondary/10 rounded">
									<Search class="w-4 h-4 text-secondary" />
								</div>
								Buscar Evaluación
							</label>
							<input
								type="text"
								placeholder="Buscar por nombre o grupo..."
								class="input input-bordered w-full bg-base-100 focus:border-primary transition-colors"
								bind:value={searchQuery}
							/>
						</div>
					</div>

					<div class="card bg-base-100 border border-base-300/20 shadow-sm">
						<div class="card-body p-0">
							<div class="max-h-96 overflow-y-auto">
								<table class="table table-zebra table-pin-rows">
									<thead class="bg-gradient-to-r from-base-200 to-base-100">
										<tr>
											<th class="font-semibold">
												<div class="flex items-center gap-2">
													<School class="w-4 h-4 text-primary" />
													Evaluación
												</div>
											</th>
											<th class="text-center font-semibold">Grupo</th>
											<th class="text-center font-semibold">Fecha</th>
											<th class="text-center font-semibold">Acción</th>
										</tr>
									</thead>
									<tbody>
										{#each filteredEvals() as item (item.code)}
											<tr class="hover:bg-base-200/50 transition-colors">
												<td class="font-medium">{item.name}</td>
												<td class="text-center">
													<span class="badge badge-outline badge-sm">{item.group_name}</span>
												</td>
												<td class="text-center">
													<span class="text-xs text-base-content/70 font-mono">
														{formatDate(String(item.eval_date))}
													</span>
												</td>
												<td class="text-center">
													<button
														class="btn btn-sm {selectedEval?.code === item.code
															? 'btn-success'
															: 'btn-primary'} transition-all"
														onclick={() => {
															onSelectEval(item);
															closeModal();
														}}
														disabled={selectedEval?.code === item.code || loading}
													>
														{#if selectedEval?.code === item.code}
															<div class="flex items-center gap-1">
																<svg
																	class="w-3 h-3"
																	fill="none"
																	stroke="currentColor"
																	viewBox="0 0 24 24"
																>
																	<path
																		stroke-linecap="round"
																		stroke-linejoin="round"
																		stroke-width="2"
																		d="M5 13l4 4L19 7"
																	></path>
																</svg>
																Seleccionado
															</div>
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
														<div class="p-3 bg-base-200 rounded-full">
															<Search class="w-6 h-6 text-base-content/30" />
														</div>
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
			{/if}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>cerrar</button></form>
</dialog>
