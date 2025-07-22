<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount, onDestroy } from 'svelte';
	import type { Courses } from '$lib/types';
	import { EllipsisVertical, ChevronUp, ChevronDown } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { can } from '$lib/stores/permissions';

	// Estados y referencias
	let modal: HTMLDialogElement | null = $state(null);
	let confirmModal: HTMLDialogElement | null = $state(null);
	let isEditing = $state(false);
	let message = $state('');
	let selectedcourse = $state<Courses | null>(null);
	let isReordering = $state(false);

	const { data } = $props<{ data: { courses: Courses[] } }>();

	// Permissions - using Svelte 5 reactive approach
	let canCreate = $derived(can('courses:create'));
	let canUpdate = $derived(can('courses:update'));
	let canDelete = $derived(can('courses:delete'));

	function openCreateModal() {
		if (!canCreate) return;
		isEditing = false;
		modal?.showModal();
	}

	function openEditModal(course: Courses) {
		if (!canUpdate) return;
		isEditing = true;
		selectedcourse = course;
		modal?.showModal();

		const nameInput = modal?.querySelector<HTMLInputElement>('#name');
		if (nameInput) nameInput.value = course.name || '';
	}

	function openDeleteConfirmModal(course: Courses) {
		selectedcourse = course;
		confirmModal?.showModal();
	}

	// Validar formulario
	function validateForm(formData: FormData): boolean {
		const name = (formData.get('name') as string)?.trim();
		if (!name) {
			message = 'Todos los campos son obligatorios';
			return false;
		}
		message = '';
		return true;
	}

	// Enviar datos (crear o editar)
	async function handleSubmit(event: Event) {
		event.preventDefault();

		const formElement = event.currentTarget as HTMLFormElement;
		const dataToSend = new FormData(formElement);
		const action: 'create' | 'update' = isEditing ? 'update' : 'create';

		if (isEditing) {
			dataToSend.append('code', selectedcourse?.code || '');
		}

		if (!validateForm(dataToSend)) return;

		try {
			const response = await fetch(`?/${action}`, { method: 'POST', body: dataToSend });
			const res = await response.json();

			if (res.type === 'success') {
				showToast(`${isEditing ? 'Curso actualizado' : 'Curso creado'} exitosamente`, 'success');
				await invalidate('courses:load'); // Unificar tag de invalidación
				modal?.close();
				isEditing = false;
			} else {
				message = `Ocurrió un error al ${isEditing ? 'actualizar' : 'crear'} el curso`;
			}
		} catch {
			message = `Ocurrió un error al ${isEditing ? 'actualizar' : 'crear'} el curso`;
		}
	}

	// Reiniciar formulario al cerrar modal
	function resetFormOnClose() {
		selectedcourse = null;
		message = '';
		const form = modal?.querySelector('form');
		if (form) form.reset();
	}

	onMount(() => {
		modal?.addEventListener('close', resetFormOnClose);
	});

	onDestroy(() => {
		modal?.removeEventListener('close', resetFormOnClose);
	});

	// Manejar eliminación
	async function handleDelete() {
		if (!selectedcourse) return;

		const dataToSend = new FormData();
		dataToSend.append('code', selectedcourse.code);

		try {
			const response = await fetch('?/delete', {
				method: 'POST',
				body: dataToSend
			});
			const res = await response.json();
			confirmModal?.close();
			selectedcourse = null;

			if (res.type === 'success') {
				showToast('Curso eliminado exitosamente', 'success');
				await invalidate('courses:load');
			} else {
				showToast(responseMessage(res) ?? '', 'danger');
			}
		} catch {
			showToast('Error en la eliminación del curso', 'danger');
		}
	}

	// Manejar reordenamiento
	async function handleReorder(course: Courses, direction: 'up' | 'down') {
		if (isReordering) return;

		isReordering = true;
		const dataToSend = new FormData();
		dataToSend.append('code', course.code);
		dataToSend.append('direction', direction);

		try {
			const response = await fetch('?/reorder', {
				method: 'POST',
				body: dataToSend
			});
			const res = await response.json();

			if (res.type === 'success') {
				await invalidate('courses:load');
			} else {
				showToast(responseMessage(res) ?? 'Error al reordenar', 'danger');
			}
		} catch {
			showToast('Error al reordenar el curso', 'danger');
		} finally {
			isReordering = false;
		}
	}
</script>

<PageTitle title="Cursos" description="Aquí puedes ver y gestionar los cursos disponibles">
	<button class="btn btn-primary" onclick={openCreateModal} disabled={!canCreate}>Añadir</button>
</PageTitle>

<div class="space-y-4 p-4">
	{#each data.courses as course (course.code)}
		{@render courseItem(course)}
	{/each}
</div>

<!-- Modal para crear o editar -->
<dialog bind:this={modal} class="modal">
	<div class="modal-box">
		<form onsubmit={handleSubmit} autocomplete="off">
			<h3 class="text-lg font-bold">{isEditing ? 'Editar' : 'Crear'} curso</h3>
			<fieldset class="fieldset bg-base-200 border border-base-300 p-4 rounded-box">
				<label class="fieldset-legend" for="name">Nombre</label>
				<input
					id="name"
					name="name"
					required
					type="text"
					class="input w-full validator"
					placeholder="Ej: Matemática, Química, etc."
				/>
			</fieldset>
			{#if message}
				<div class="px-2 mt-2">
					<Message description={message} type="warning" />
				</div>
			{/if}
			<div class="modal-action flex justify-center gap-2">
				<button class="btn btn-error" type="button" onclick={() => modal?.close()}>Cancelar</button>
				<button class="btn btn-primary" type="submit">
					{isEditing ? 'Actualizar' : 'Guardar'}
				</button>
			</div>
		</form>
	</div>
</dialog>

<!-- Modal para confirmar eliminación -->
<dialog bind:this={confirmModal} class="modal bg-base-200">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Confirmar eliminación</h3>
		<p class="py-4">¿Estás seguro que deseas eliminar el curso "{selectedcourse?.name}"?</p>
		<div class="modal-action flex justify-center gap-2">
			<button class="btn" onclick={() => confirmModal?.close()}>Cancelar</button>
			<button class="btn btn-error" onclick={handleDelete}>Eliminar</button>
		</div>
	</div>
</dialog>

{#snippet courseItem(item: Courses)}
	<div
		class="rounded-box bg-base-200 py-3 px-4 hover:bg-base-300 transition-colors text-left relative"
	>
		<div class="flex items-center justify-between">
			<div class="flex-1">
				<div class="font-medium text-base-content">{item.name}</div>
			</div>
			<div class="flex items-center gap-2">
				{#if canUpdate}
					<div class="flex flex-col">
						<button
							type="button"
							class="btn btn-xs btn-ghost btn-square"
							onclick={() => handleReorder(item, 'up')}
							disabled={isReordering}
							title="Mover arriba"
						>
							<ChevronUp class="w-4 h-4" />
						</button>
						<button
							type="button"
							class="btn btn-xs btn-ghost btn-square"
							onclick={() => handleReorder(item, 'down')}
							disabled={isReordering}
							title="Mover abajo"
						>
							<ChevronDown class="w-4 h-4" />
						</button>
					</div>
				{/if}
				<div class="dropdown dropdown-end">
					<button type="button" class="m-1 cursor-pointer">
						<EllipsisVertical class="w-4 h-4" />
					</button>
					<ul class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow">
						<li>
							<button onclick={() => openEditModal(item)}>Editar</button>
						</li>
						{#if canDelete}
							<li>
								<button onclick={() => openDeleteConfirmModal(item)}> Eliminar </button>
							</li>
						{/if}
					</ul>
				</div>
			</div>
		</div>
	</div>
{/snippet}
