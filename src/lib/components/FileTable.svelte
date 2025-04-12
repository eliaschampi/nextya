<script lang="ts">
	import { Play, X, Loader2, Eye } from 'lucide-svelte';
	import ProcessingStatus from './ProcessingStatus.svelte';
	import type { OmrProcessedResult } from '$lib/types/omrProcessing';

	const {
		files = [],
		processedResults = {},
		selectedIndex = -1,
		isProcessing = false,
		processingIndex = -1,
		evalSelected = false,
		onSelect = () => {},
		onProcess = () => {},
		onRemove = () => {},
		onViewDetails = () => {}
	} = $props<{
		files: File[];
		processedResults: Record<number, OmrProcessedResult>;
		selectedIndex: number;
		isProcessing: boolean;
		processingIndex: number;
		evalSelected: boolean;
		onSelect?: (index: number) => void;
		onProcess?: (index: number) => void;
		onRemove?: (index: number) => void;
		onViewDetails?: (index: number) => void;
	}>();
</script>

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
			{#each files as file, index (index)}
				<tr
					class="hover:bg-base-200 cursor-pointer {selectedIndex === index
						? 'bg-primary/10 border-l-4 border-primary'
						: ''}"
					onclick={() => onSelect(index)}
				>
					<td class="truncate max-w-[150px]" title={file.name}>
						<div class="font-medium">{file.name}</div>
					</td>
					<td>
						<ProcessingStatus
							status={isProcessing && processingIndex === index
								? 'processing'
								: processedResults[index]?.status === 'success'
									? 'success'
									: processedResults[index]?.status === 'error'
										? 'error'
										: 'pending'}
							message={processedResults[index]?.message || ''}
							score={processedResults[index]?.results?.totalScore || null}
							studentName={processedResults[index]?.student?.name || ''}
							studentLastName={processedResults[index]?.student?.lastName || ''}
						/>
					</td>
					<td class="text-right">
						<div class="flex gap-1 justify-end">
							{#if !processedResults[index] || processedResults[index]?.status === 'error'}
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

							{#if processedResults[index]?.status === 'success' && processedResults[index]?.student}
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

							<button
								class="btn btn-ghost btn-xs"
								onclick={(e) => {
									e.stopPropagation();
									onRemove(index);
								}}
								disabled={isProcessing && processingIndex === index}
							>
								<X size={16} />
							</button>
						</div>
					</td>
				</tr>
			{:else}
				<tr><td colspan="3" class="text-center py-8 opacity-50">Sin archivos</td></tr>
			{/each}
		</tbody>
	</table>
</div>
