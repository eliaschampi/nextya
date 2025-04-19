<script lang="ts">
	// routes/(home)/levels/+page.svelte
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount, onDestroy } from 'svelte';
	import type { Level } from '../../../app';
	import { EllipsisVertical } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { getModalityTypes } from '$lib/data/modality';
	import { permissionsStore } from '$lib/stores/permissions';

	// Estados y referencias
	let modal: HTMLDialogElement | null = $state(null);
	let confirmModal: HTMLDialogElement | null = $state(null);
	let isEditing = $state(false);
	let message = $state('');
	let selectedLevel = $state<Level | null>(null);
	const modalities = getModalityTypes();

	const { data } = $props<{ data: { levels: Level[] } }>();
	const canCreate = permissionsStore.has({ entity: 'levels', action: 'create' });
	const canUpdate = permissionsStore.has({ entity: 'levels', action: 'update' });
	const canDelete = permissionsStore.has({ entity: 'levels', action: 'delete' });

	// Abrir modal para crear
	function openCreateModal() {
		isEditing = false;
		modal?.showModal();
	}

	// Abrir modal para editar
	function openEditModal(level: Level) {
		isEditing = true;
		selectedLevel = level;
		modal?.showModal();

		const nameInput = modal?.querySelector<HTMLInputElement>('#name');
		const abrInput = modal?.querySelector<HTMLTextAreaElement>('#abr');
		if (nameInput) nameInput.value = level.name || '';
		if (abrInput) abrInput.value = level.abr || '';
	}

	// Abrir modal para confirmar eliminación
	function openDeleteConfirmModal(level: Level) {
		selectedLevel = level;
		confirmModal?.showModal();
	}

	// Validar formulario
	function validateForm(formData: FormData): boolean {
		const name = (formData.get('name') as string)?.trim();
		const abr = (formData.get('abr') as string)?.trim();

		if (!name || !abr) {
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
			dataToSend.append('code', selectedLevel?.code || '');
		}

		if (!validateForm(dataToSend)) return;

		try {
			const response = await fetch(`?/${action}`, { method: 'POST', body: dataToSend });
			const res = await response.json();

			if (res.type === 'success') {
				showToast(`${isEditing ? 'Nivel actualizado' : 'Nivel creado'} exitosamente`, 'success');
				await invalidate('levels:load'); // Unificar tag de invalidación
				modal?.close();
				isEditing = false;
			} else {
				message = `Ocurrió un error al ${isEditing ? 'actualizar' : 'crear'} el nivel`;
			}
		} catch {
			message = `Ocurrió un error al ${isEditing ? 'actualizar' : 'crear'} el nivel`;
		}
	}

	// Reiniciar formulario al cerrar modal
	function resetFormOnClose() {
		selectedLevel = null;
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
		if (!selectedLevel) return;

		const dataToSend = new FormData();
		dataToSend.append('code', selectedLevel.code);

		try {
			const response = await fetch('?/delete', {
				method: 'POST',
				body: dataToSend
			});
			const res = await response.json();
			confirmModal?.close();
			selectedLevel = null;

			if (res.type === 'success') {
				showToast('Nivel eliminado exitosamente', 'success');
				await invalidate('levels:load');
			} else {
				showToast(responseMessage(res) ?? '', 'danger');
			}
		} catch {
			showToast('Error en la eliminación del nivel', 'danger');
		}
	}
</script>

<PageTitle
	title="Niveles"
	description="Aquí encontrarás todas las niveles disponibles en la aplicación."
>
	{#if $canCreate}
		<button class="btn btn-primary" onclick={openCreateModal}>Añadir</button>
	{/if}
</PageTitle>

<div class="space-y-4 p-4">
	{#each data.levels as level (level.code)}
		{@render levelItem(level)}
	{/each}
</div>

<!-- Modal para crear o editar -->
<dialog bind:this={modal} class="modal">
	<div class="modal-box">
		<form onsubmit={handleSubmit} autocomplete="off">
			<h3 class="text-lg font-bold">{isEditing ? 'Editar' : 'Crear'} nivel</h3>
			<fieldset class="fieldset bg-base-200 border border-base-300 p-4 rounded-box">
				<label class="fieldset-legend" for="name">Nombre</label>
				<input
					id="name"
					name="name"
					required
					type="text"
					class="input w-full validator"
					placeholder="Ej: Ordinario, Secundaria, etc."
					maxlength={20}
				/>
				<div class="mt-2">
					<label class="label font-medium" for="group_name">Modalidad</label>
					<select id="abr" name="abr" class="select w-full validator" required>
						<option value="">Selecciona una modalidad</option>
						{#each modalities as abr (abr)}
							<option value={abr}>{abr}</option>
						{/each}
					</select>
				</div>
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
		<p class="py-4">¿Estás seguro que deseas eliminar el nivel "{selectedLevel?.name}"?</p>
		<div class="modal-action flex justify-center gap-2">
			<button class="btn" onclick={() => confirmModal?.close()}>Cancelar</button>
			<button class="btn btn-error" onclick={handleDelete}>Eliminar</button>
		</div>
	</div>
</dialog>

{#snippet levelItem(item: Level)}
	<div
		class="rounded-box bg-base-200 py-3 px-4 hover:bg-base-300 transition-colors text-left relative"
	>
		<div class="flex items-center justify-between">
			<div class="flex-1">
				<div class="font-medium text-base-content">{item.name}</div>
				<div class="text-sm text-base-content/70">{item.abr}</div>
			</div>
			<div class="flex items-center gap-1">
				{#if item.created_at}
					<div class="badge badge-soft badge-primary">
						{new Date(item.created_at).getFullYear()}
					</div>
				{/if}
				<div class="divider divider-horizontal"></div>
				<div class="dropdown dropdown-end">
					<div tabindex="0" role="button" class="m-1 cursor-pointer">
						<EllipsisVertical class="w-4 h-4" />
					</div>
					<ul class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
						<li>
							<button onclick={() => openEditModal(item)} disabled={!$canUpdate}>Editar</button>
						</li>
						<li>
							<button onclick={() => openDeleteConfirmModal(item)} disabled={!$canDelete}>
								Eliminar
							</button>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
{/snippet}
