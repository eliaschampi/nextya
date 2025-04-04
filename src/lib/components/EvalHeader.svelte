<script lang="ts">
	import type { Eval, Level } from '../../app';
	import { School, BookOpen } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/formatDate';
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

	// Calcular el nombre del nivel, ya sea desde el nivel proporcionado o desde la evaluación
	const levelName = $derived(level?.name || evaluation?.levels?.name || 'Sin nivel');

	// Calcular el total de preguntas si hay secciones disponibles
	const totalQuestions = $derived(
		evaluation?.eval_sections
			? evaluation.eval_sections.reduce(
					(sum: number, section: { question_count: number }) =>
						sum + Number(section.question_count),
					0
				)
			: 0
	);
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
					{#if totalQuestions > 0}
						<span class="badge badge-secondary badge-outline">{totalQuestions} preguntas</span>
					{/if}
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
			<div class="alert alert-warning mt-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="stroke-current shrink-0 h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				<span>Esta evaluación no tiene secciones configuradas.</span>
			</div>
		{/if}
	</div>
</div>
