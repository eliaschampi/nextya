<script lang="ts">
	import type { Eval, Level } from '$lib/types';
	import { School, BookOpen } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/formatDate';
	import Message from './Message.svelte';
	const {
		children,
		evaluation,
		level,
		showSelectButton = false,
		onSelectClick
	} = $props<{
		evaluation: Eval & {
			eval_sections?: Array<{ question_count: number }>;
			levels?: { name: string };
		};
		level?: Level;
		showSelectButton?: boolean;
		onSelectClick?: () => void;
		children?: () => unknown;
	}>();

	const levelName = $derived(level?.name || evaluation?.levels?.name || 'Sin nivel');
</script>

<div class="card bg-base-200/80 shadow mb-4">
	<div class="card-body p-4">
		<header class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
			<div class="flex flex-col">
				<h3 class="card-title flex items-center gap-2">
					<School class="text-primary" size={20} />
					{evaluation.name}
				</h3>
				<div class="flex items-center flex-wrap gap-2 mt-2">
					<span class="badge badge-primary badge-outline">{levelName}</span>
					<span class="badge">Grupo {evaluation.group_name}</span>
					<span class="badge badge-ghost">{formatDate(evaluation.eval_date)}</span>
				</div>
			</div>
			{#if showSelectButton && onSelectClick}
				<button class="btn btn-primary btn-sm mt-2 sm:mt-0" onclick={onSelectClick}>
					<BookOpen size={16} class="mr-1" />
					Seleccionar
				</button>
			{/if}
		</header>

		{#if evaluation.eval_sections && evaluation.eval_sections.length > 0}
			{@render children?.()}
		{:else}
			<Message description="Esta evaluación no tiene secciones configuradas." type="warning" />
		{/if}
	</div>
</div>
