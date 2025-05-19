<script lang="ts">
	import { User } from 'lucide-svelte';
	import { studentStore } from '$lib/stores/student';
	import type { Student, StudentRegister } from '$lib/types';

	// Props with defaults
	const { className = '' } = $props<{
		className?: string;
	}>();

	// Store state
	let storeState = $state({
		selectedStudent: null as Student | null,
		registers: [] as StudentRegister[],
		selectedRegister: null as string | null
	});

	// Subscribe to the store
	$effect(() => {
		const unsubscribe = studentStore.subscribe((state) => {
			storeState = {
				selectedStudent: state.selectedStudent,
				registers: state.registers,
				selectedRegister: state.selectedRegister
			};
		});
		return unsubscribe;
	});

	// Filter by register function
	function filterByRegister(registerCode: string | null) {
		studentStore.setSelectedRegister(registerCode);
	}
</script>

{#if storeState.selectedStudent}
	<div
		class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl mb-6 {className}"
	>
		<div class="card-body">
			<h2 class="card-title text-primary flex items-center gap-2">
				<User size={20} />
				{storeState.selectedStudent.name}
				{storeState.selectedStudent.last_name}
			</h2>
			{#if storeState.registers.length > 0}
				<div class="flex flex-wrap gap-2 mt-2">
					<button
						class="btn btn-sm btn-primary {storeState.selectedRegister === null
							? ''
							: 'btn-outline'}"
						onclick={() => filterByRegister(null)}
					>
						Todos
					</button>
					{#each storeState.registers as register (register.code)}
						<button
							class="btn btn-sm btn-primary {storeState.selectedRegister === register.code
								? ''
								: 'btn-outline'}"
							onclick={() => filterByRegister(register.code)}
						>
							{register.levels.name} - {register.group_name}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
