<script lang="ts">
	import { User, X, Search } from 'lucide-svelte';
	import type { Students } from '$lib/types';
	import Message from './Message.svelte';
	import { onMount, onDestroy } from 'svelte';

	type Props = {
		open?: boolean;
		onClose?: () => void;
		onSelect?: (student: Students) => void;
	};

	const { open = false, onClose = () => {}, onSelect = () => {} }: Props = $props();

	// Modal state
	let modal = $state<HTMLDialogElement | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<Students[]>([]);
	let searchLoading = $state(false);

	// Modal control
	$effect(() => {
		if (open && modal && !modal.open) {
			modal.showModal();
			// Focus search input
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

		const handleClose = () => {
			if (open) {
				resetSearch();
				onClose();
			}
		};

		modalElement.addEventListener('close', handleClose);
		return () => modalElement.removeEventListener('close', handleClose);
	});

	// Search for students
	async function searchStudents() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}

		searchLoading = true;
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
			searchLoading = false;
		}
	}

	// Handle Enter key
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			searchStudents();
		}
	}

	// Select student
	function handleSelectStudent(student: Students) {
		onSelect(student);
		closeModal();
	}

	// Close modal
	function closeModal() {
		modal?.close();
	}

	// Reset search
	function resetSearch() {
		searchQuery = '';
		searchResults = [];
	}

	onMount(() => {
		modal?.addEventListener('close', resetSearch);
	});

	onDestroy(() => {
		modal?.removeEventListener('close', resetSearch);
		// Ensure modal is closed on unmount
		if (modal?.open) {
			modal.close();
		}
	});
</script>

<!-- Student Search Modal -->
<dialog bind:this={modal} class="modal">
	<div class="modal-box max-w-md">
		<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={closeModal}>
			<X size={20} />
		</button>
		<h3 class="font-bold text-lg mb-4 flex items-center gap-2">
			<User size={20} />
			Buscar Estudiante
		</h3>

		<div class="join w-full mb-4">
			<input
				id="student-search"
				type="text"
				placeholder="Buscar por nombre o apellido"
				class="input input-bordered join-item flex-1"
				bind:value={searchQuery}
				onkeydown={handleKeyDown}
				autocomplete="off"
			/>
			<button
				class="btn btn-primary join-item"
				onclick={searchStudents}
				disabled={!searchQuery.trim() || searchLoading}
			>
				{#if searchLoading}
					<span class="loading loading-spinner loading-xs"></span>
				{:else}
					<Search size={16} />
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
						</button>
					</li>
				{/each}
			</ul>
		{:else if searchQuery && !searchLoading}
			<Message
				description="No se encontraron estudiantes con ese criterio de búsqueda."
				type="info"
			/>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>cerrar</button>
	</form>
</dialog>
