<script lang="ts">
	import { X, Search, User } from 'lucide-svelte';
	import type { Student } from '$lib/types';
	import { fade } from 'svelte/transition';

	const {
		open = false,
		onClose = () => {},
		onSelectStudent = () => {}
	} = $props<{
		open?: boolean;
		onClose?: () => void;
		onSelectStudent?: (student: Student) => void;
	}>();

	let modal = $state<HTMLDialogElement | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<Student[]>([]);
	let loading = $state(false);

	// Modal control
	$effect(() => {
		if (open && modal && !modal.open) {
			modal.showModal();
			// Focus search input when modal opens
			queueMicrotask(() => {
				const searchInput = modal?.querySelector<HTMLInputElement>('#student-search');
				searchInput?.focus();
			});
		} else if (!open && modal?.open) {
			modal.close();
		}
	});

	// Close event handling
	$effect(() => {
		const modalElement = modal;
		if (!modalElement) return;

		const handleClose = () => onClose();
		modalElement.addEventListener('close', handleClose);
		return () => modalElement.removeEventListener('close', handleClose);
	});

	function closeModal() {
		modal?.close();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			searchStudents();
		}
	}

	async function searchStudents() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}

		loading = true;
		try {
			const response = await fetch(`/api/student?search=${encodeURIComponent(searchQuery)}`);
			if (response.ok) {
				searchResults = await response.json();
			} else {
				searchResults = [];
			}
		} catch (error) {
			console.error('Error searching students:', error);
			searchResults = [];
		} finally {
			loading = false;
		}
	}

	function handleSelectStudent(student: Student) {
		onSelectStudent(student);
		closeModal();
	}
</script>

<dialog bind:this={modal} class="modal">
	<div class="modal-box max-w-md" transition:fade>
		<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={closeModal}>
			<X size={20} />
		</button>
		<h3 class="text-xl font-bold text-primary flex items-center gap-2 mb-4">
			<User class="w-6 h-6" /> Buscar Estudiante
		</h3>

		<div class="join w-full mb-4">
			<input
				id="student-search"
				type="text"
				placeholder="Buscar por nombre o apellido"
				class="input input-bordered join-item flex-1"
				bind:value={searchQuery}
				onkeydown={handleKeyDown}
			/>
			<button
				class="btn btn-primary join-item"
				onclick={searchStudents}
				disabled={!searchQuery.trim() || loading}
			>
				{#if loading}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Search class="w-4 h-4" />
				{/if}
			</button>
		</div>

		{#if searchResults.length > 0}
			<ul class="space-y-2 max-h-64 overflow-y-auto">
				{#each searchResults as student (student.code)}
					<li
						class="bg-base-200 p-3 rounded-box hover:bg-base-300 transition-colors cursor-pointer"
					>
						<button
							class="w-full text-left"
							onclick={() => handleSelectStudent(student)}
							type="button"
						>
							<div class="font-medium">{student.name} {student.last_name}</div>
							<div class="text-xs opacity-70">{student.email}</div>
						</button>
					</li>
				{/each}
			</ul>
		{:else if searchQuery && !loading}
			<div class="alert alert-info">
				<div>
					<span>No se encontraron estudiantes con ese nombre.</span>
				</div>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>cerrar</button>
	</form>
</dialog>
