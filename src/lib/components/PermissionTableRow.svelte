<script lang="ts">
	import { ACTIONS } from '$lib/types/permissions';
	import type { Action, EntityPermissions } from '$lib/types/permissions';

	export let entity: string;
	export let permission: EntityPermissions;
	export let loading: boolean;
	// Permite cambiar el valor de un permiso individual
	export let onPermissionChange: (action: Action, value: boolean) => void;

	function handleChange(action: Action, e: Event) {
		const target = e.target as HTMLInputElement | null;
		if (target && typeof target.checked === 'boolean') {
			onPermissionChange(action, target.checked);
		}
	}
</script>

<tr>
	<td>{entity}</td>
	{#each ACTIONS as action (action)}
		<td class="text-center">
			<input
				type="checkbox"
				class="toggle toggle-primary toggle-sm"
				checked={permission[action]}
				disabled={loading}
				onchange={(e) => handleChange(action, e)}
			/>
		</td>
	{/each}
</tr>
