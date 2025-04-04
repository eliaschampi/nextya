<script lang="ts">
	const {
		status,
		message = '',
		score = null,
		studentName = '',
		studentLastName = ''
	} = $props<{
		status: 'pending' | 'processing' | 'success' | 'error';
		message?: string;
		score?: number | null;
		studentName?: string;
		studentLastName?: string;
	}>();

	import { Loader2, Check, X, AlertCircle } from 'lucide-svelte';
</script>

<div class="flex flex-col gap-1">
	{#if status === 'processing'}
		<div class="flex items-center gap-1">
			<span class="badge badge-info gap-1">
				<Loader2 size={12} class="animate-spin" /> Procesando
			</span>
			<div class="ml-2 w-full bg-base-300 rounded-full h-1.5">
				<div class="bg-info h-1.5 rounded-full animate-pulse" style="width: 60%"></div>
			</div>
		</div>
	{:else if status === 'success'}
		<div class="flex flex-col gap-1">
			<span class="badge badge-success gap-1"><Check size={12} /> Procesado</span>
			{#if studentName}
				<span class="text-xs">
					Estudiante: <b>{studentName} {studentLastName}</b>
				</span>
			{/if}
			{#if score !== null}
				<span class="text-xs">
					Nota: <b class={score >= 7 ? 'text-success' : score >= 4 ? 'text-warning' : 'text-error'}>
						{score.toFixed(2)}
					</b>
				</span>
			{/if}
		</div>
	{:else if status === 'error'}
		<div class="flex flex-col gap-1">
			<span class="badge badge-error gap-1"><X size={12} /> Error</span>
			{#if message}
				<span class="text-xs text-error">{message}</span>
			{/if}
		</div>
	{:else}
		<span class="badge badge-warning gap-1">
			<AlertCircle size={12} /> Pendiente
		</span>
	{/if}
</div>
