<script lang="ts">
	import { Play, Loader2, CheckCircle } from 'lucide-svelte';
	const {
		isProcessing = false,
		pendingCount = 0,
		totalCount = 0,
		onProcessAll
	} = $props<{
		isProcessing?: boolean;
		pendingCount?: number;
		totalCount?: number;
		onProcessAll: () => Promise<void>;
	}>();
</script>

{#if pendingCount > 0}
	<div class="card bg-base-200/80 shadow">
		<div class="card-body p-3">
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-2">
					<h3 class="text-sm font-medium">Procesamiento por lotes</h3>
					<div class="badge badge-primary badge-outline">{pendingCount} pendientes</div>
				</div>

				<button
					class="btn btn-primary btn-sm {isProcessing ? 'btn-disabled' : ''}"
					onclick={onProcessAll}
					disabled={isProcessing || pendingCount === 0}
				>
					{#if isProcessing}
						<Loader2 class="animate-spin mr-1" size={16} />
						Procesando...
					{:else}
						<Play size={16} class="mr-1" />
						Procesar todos
					{/if}
				</button>
			</div>
			{#if isProcessing}
				<div class="mt-2">
					<div class="w-full bg-base-300 rounded-full h-1.5 mb-1">
						<div
							class="bg-primary h-1.5 rounded-full transition-all duration-300"
							style="width: {((totalCount - pendingCount) / totalCount) * 100}%"
						></div>
					</div>
					<div class="text-xs text-right">
						{totalCount - pendingCount} de {totalCount} ({Math.round(
							((totalCount - pendingCount) / totalCount) * 100
						)}%)
					</div>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="alert alert-success py-2 px-4">
		<CheckCircle class="w-5 h-5" />
		<span>Todos los archivos han sido procesados.</span>
	</div>
{/if}
