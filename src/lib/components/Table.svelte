<script lang="ts">
	/**
	 * A reusable table component with consistent styling
	 */

	const {
		columns,
		rows,
		emptyMessage = 'Sin datos para mostrar.',
		bordered = true,
		striped = true,
		compact = false,
		pinRows = true,
		rounded = true,
		hover = true,
		className = ''
	} = $props<{
		// Using a more flexible type definition to avoid type errors
		columns: {
			key?: string;
			label: string;
			headerClass?: string;
			class?: string;
			cell?: (row: unknown) => unknown;
		}[];
		rows: unknown[];
		emptyMessage?: string;
		bordered?: boolean;
		striped?: boolean;
		compact?: boolean;
		pinRows?: boolean;
		rounded?: boolean;
		hover?: boolean;
		className?: string;
	}>();

	const totalColumns = columns.length;

	// No additional processing needed as we're using {@html} directly
</script>

<div class={`overflow-x-auto ${rounded ? 'rounded-lg' : ''} ${className}`}>
	<table
		class={`table w-full
		${pinRows ? 'table-pin-rows' : ''}
		${striped ? 'table-zebra' : ''}
		${compact ? 'table-xs' : 'table-sm'}
		${bordered ? 'border border-base-300/30' : ''}
		bg-base-100/50`}
	>
		<thead>
			<tr class="bg-base-200/70">
				{#each columns as col, colIdx (colIdx)}
					<th class={`text-left ${col.headerClass || ''}`}>{col.label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if rows.length === 0}
				<tr>
					<td colspan={totalColumns} class="text-center py-8 opacity-50">{emptyMessage}</td>
				</tr>
			{:else}
				{#each rows as row, rowIdx (rowIdx)}
					<tr
						class={`${hover ? 'hover:bg-primary/10' : ''} transition-colors border-b border-base-300 last:border-b-0`}
					>
						{#each columns as col, colIdx (colIdx)}
							<td class={col.class}>
								{#if col.cell}
									{@const cellContent = col.cell(row)}
									{#if typeof cellContent === 'string' && cellContent.includes('<')}
										<!-- We need to use innerHTML for SVG icons to work properly -->
										<!-- eslint-disable-next-line svelte/no-at-html-tags -->
										<span>{@html cellContent}</span>
									{:else}
										{cellContent}
									{/if}
								{:else if col.key}
									{row[col.key] ?? '—'}
								{:else}
									—
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<style>
	.table th,
	.table td {
		vertical-align: middle;
	}
</style>
