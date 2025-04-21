<script lang="ts">
	import type { Eval, EvalSection } from '$lib/types';
	import { BookOpen, ListChecks } from 'lucide-svelte';

	const { evaluation } = $props<{
		evaluation: Eval & {
			eval_sections?: (EvalSection & { course_name?: string; courses?: { name: string } })[];
			levels?: { name: string };
		};
	}>();
</script>

{#if evaluation.eval_sections && evaluation.eval_sections.length > 0}
	<div class="overflow-x-auto mt-2">
		<table class="table table-sm table-zebra bg-base-100/50 rounded-lg">
			<thead>
				<tr>
					<th class="w-8 text-center">#</th>
					<th>Curso</th>
					<th class="text-center">Preguntas</th>
				</tr>
			</thead>
			<tbody>
				{#each evaluation.eval_sections as section (section.code)}
					<tr>
						<td class="text-center">{section.order_in_eval}</td>
						<td class="flex items-center gap-2">
							<BookOpen size={16} class="text-primary" />
							{section.course_name || section.courses?.name || 'Sin nombre'}
						</td>
						<td class="text-center">
							<div class="flex items-center justify-center gap-1">
								<ListChecks size={14} />
								{section.question_count}
							</div>
						</td>
					</tr>
				{/each}
				<tr class="font-semibold">
					<td colspan="2" class="text-right">Total:</td>
					<td class="text-center">
						{evaluation.eval_sections.reduce(
							(sum: number, section: { question_count: number }) => sum + section.question_count,
							0
						)}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
{/if}
