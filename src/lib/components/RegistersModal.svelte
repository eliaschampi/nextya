<script lang="ts">
	import { X, Book } from 'lucide-svelte';
	import type { StudentRegister } from '$lib/types';
	import Message from './Message.svelte';
	import { fade } from 'svelte/transition';

	type Props = {
		studentCode: string;
		studentName: string;
		open?: boolean;
		onClose?: () => void;
	};

	const { studentCode = '', studentName = '', open = false, onClose = () => {} }: Props = $props();

	let modal = $state<HTMLDialogElement | null>(null);
	let registers = $state<StudentRegister[]>([]);
	let loading = $state(false);
	let error = $state('');

	$effect(() => {
		if (open && modal && !modal.open) {
			modal.showModal();
			fetchRegisters();
		} else if (!open && modal?.open) {
			modal.close();
		}
	});

	$effect(() => {
		const modalElement = modal;
		if (!modalElement) return;
		const handleClose = () => {
			if (open) onClose(); // Llama a onClose solo si el modal estaba supuesto a estar abierto
		};
		modalElement.addEventListener('close', handleClose);
		return () => modalElement.removeEventListener('close', handleClose);
	});

	function closeModal() {
		modal?.close();
	}

	async function fetchRegisters() {
		if (!studentCode) return;

		loading = true;
		error = '';

		try {
			const response = await fetch(`/api/student/results/${studentCode}`);

			if (!response.ok) {
				throw new Error('Error al cargar matrículas');
			}

			const data = await response.json();
			registers = data.registers || [];
		} catch (err) {
			console.error('Error fetching registers:', err);
			error = err instanceof Error ? err.message : 'Error desconocido';
		} finally {
			loading = false;
		}
	}
</script>

<dialog bind:this={modal} class="modal modal-bottom sm:modal-middle">
	<div class="modal-box max-w-md" transition:fade>
		<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={closeModal}>
			<X size={20} />
		</button>
		<h3 class="font-bold text-lg mb-1 flex items-center gap-2">
			<Book size={20} />
			Matrículas
		</h3>
		<p class="text-sm opacity-70 mb-4">Estudiante: {studentName}</p>

		{#if loading}
			<div class="flex justify-center my-8">
				<span class="loading loading-spinner loading-md text-primary"></span>
			</div>
		{:else if error}
			<div class="my-4">
				<Message description={error} type="error" />
			</div>
		{:else if registers.length === 0}
			<div class="bg-base-200 p-4 rounded-lg text-center">
				<p class="opacity-70">No hay matrículas registradas para este estudiante.</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full">
					<thead>
						<tr>
							<th>Nivel</th>
							<th class="text-center">Grupo</th>
							<th class="text-center">Código</th>
						</tr>
					</thead>
					<tbody>
						{#each registers as register (register.code)}
							<tr>
								<td>{register.levels?.name || 'N/A'}</td>
								<td class="text-center">
									<span class="badge badge-secondary">{register.group_name}</span>
								</td>
								<td class="text-center font-mono text-accent">{register.roll_code}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>cerrar</button>
	</form>
</dialog>
