<!-- src/routes/users/+page.svelte -->
<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount, onDestroy } from 'svelte';
	import type { User } from '../../../app';
	import { Trash } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { getInitials } from '$lib/utils/initialName';

	// Estados y referencias
	let modal: HTMLDialogElement | null = $state(null);
	let confirmModal: HTMLDialogElement | null = $state(null);
	let isEditing = $state(false);
	let message = $state('');
	let selectedUser = $state<User | null>(null);

	const { data } = $props<{ data: { users: User[] } }>();

	// Abrir modal para crear
	function openCreateModal() {
		isEditing = false;
		modal?.showModal();
	}

	// Abrir modal para editar
	function openEditModal(user: User) {
		isEditing = true;
		selectedUser = user;
		modal?.showModal();

		const nameInput = modal?.querySelector<HTMLInputElement>('#name');
		const lastnameInput = modal?.querySelector<HTMLInputElement>('#last_name');
		const emailInput = modal?.querySelector<HTMLInputElement>('#email');
		const passwordInput = modal?.querySelector<HTMLInputElement>('#password');
		const isActiveInput = modal?.querySelector<HTMLInputElement>('#is_active');

		if (nameInput) nameInput.value = user.name || '';
		if (lastnameInput) lastnameInput.value = user.last_name || '';
		if (emailInput) emailInput.value = user.email || '';
		if (passwordInput) passwordInput.value = '';
		if (isActiveInput) isActiveInput.checked = user.is_active;
	}

	// Abrir modal para confirmar eliminación
	function openDeleteConfirmModal(user: User) {
		selectedUser = user;
		confirmModal?.showModal();
	}

	// Validar formulario
	function validateForm(formData: FormData): boolean {
		const name = (formData.get('name') as string)?.trim();
		const lastName = (formData.get('last_name') as string)?.trim();
		const email = (formData.get('email') as string)?.trim();
		const password = (formData.get('password') as string)?.trim();

		if (!name || !lastName || !email) {
			message = 'Todos los campos son obligatorios';
			return false;
		}
		if (!isEditing && !password) {
			message = 'La contraseña es obligatoria al crear un usuario';
			return false;
		}
		if (password && password.length < 8) {
			message = 'La contraseña debe tener al menos 8 caracteres';
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
			dataToSend.append('user_id', selectedUser?.user_id || '');
		}

		if (!validateForm(dataToSend)) return;

		try {
			const response = await fetch(`?/${action}`, { method: 'POST', body: dataToSend });
			const res = await response.json();

			if (res.type === 'success') {
				showToast(
					`${isEditing ? 'Usuario actualizado' : 'Usuario creado'} exitosamente`,
					'success'
				);
				await invalidate('users:load');
				modal?.close();
			} else {
				message =
					responseMessage(res) || `Error al ${isEditing ? 'actualizar' : 'crear'} el usuario`;
			}
		} catch {
			message = 'Error de red al procesar la solicitud';
		}
	}

	// Reiniciar formulario al cerrar modal
	function resetFormOnClose() {
		selectedUser = null;
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
		if (!selectedUser) return;

		const dataToSend = new FormData();
		dataToSend.append('user_id', selectedUser.user_id);

		try {
			const response = await fetch('?/delete', { method: 'POST', body: dataToSend });
			const res = await response.json();
			confirmModal?.close();

			if (res.type === 'success') {
				showToast('Usuario eliminado exitosamente', 'success');
				await invalidate('users:load');
			} else {
				showToast(responseMessage(res) || 'Error al eliminar el usuario', 'danger');
			}
		} catch {
			showToast('Error de red al eliminar el usuario', 'danger');
		}
	}

	// Formatear fechas
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('es-ES', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<PageTitle title="Usuarios" description="Lista de usuarios disponibles en la aplicación.">
	<button class="btn btn-primary" onclick={openCreateModal}>Agregar Usuario</button>
</PageTitle>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
	{#each data.users as user (user.user_id)}
		{@render userCard(user)}
	{/each}
</div>

<!-- Modal para crear o editar -->
<dialog bind:this={modal} class="modal">
	<div class="modal-box">
		<form onsubmit={handleSubmit} autocomplete="off">
			<h3 class="text-lg font-bold">{isEditing ? 'Editar' : 'Crear'} usuario</h3>
			<fieldset class="fieldset bg-base-200 border border-base-300 p-4 rounded-box">
				<label class="fieldset-legend" for="name">Nombre</label>
				<input
					id="name"
					name="name"
					type="text"
					class="input w-full validator"
					placeholder="Nombre"
					required
					aria-required="true"
				/>
				<label class="fieldset-legend" for="last_name">Apellidos</label>
				<input
					id="last_name"
					name="last_name"
					type="text"
					class="input w-full validator"
					placeholder="Apellidos"
					required
					aria-required="true"
				/>
				<label class="fieldset-legend" for="email">Correo electrónico</label>
				<input
					id="email"
					name="email"
					type="email"
					class="input w-full validator"
					placeholder="Correo electrónico"
					required
					aria-required="true"
				/>
				<label class="fieldset-legend" for="password">Contraseña</label>
				<input
					id="password"
					name="password"
					type="password"
					class="input w-full validator"
					placeholder="Contraseña"
					disabled={isEditing}
					required={!isEditing}
					aria-required={!isEditing}
				/>
				<label class="fieldset-legend" for="is_active">Estado</label>
				<input id="is_active" name="is_active" type="checkbox" class="toggle toggle-primary" />
			</fieldset>
			{#if message}
				<div class="px-2 mt-2">
					<Message description={message} type="warning" />
				</div>
			{/if}
			<div class="modal-action flex justify-center gap-2">
				<button class="btn btn-error" type="button" onclick={() => modal?.close()}>Cancelar</button>
				<button class="btn btn-primary" type="submit">{isEditing ? 'Actualizar' : 'Guardar'}</button
				>
			</div>
		</form>
	</div>
</dialog>

<!-- Modal para confirmar eliminación -->
<dialog bind:this={confirmModal} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Confirmar eliminación</h3>
		<p class="py-4">
			¿Estás seguro de eliminar a "{selectedUser?.name}
			{selectedUser?.last_name}"?
		</p>
		<div class="modal-action flex justify-center gap-2">
			<button class="btn" onclick={() => confirmModal?.close()}>Cancelar</button>
			<button class="btn btn-error" onclick={handleDelete}>Eliminar</button>
		</div>
	</div>
</dialog>

{#snippet userCard(user: User)}
	<div class="card w-full bg-base-200 shadow">
		<div class="card-body p-6">
			<div class="flex items-center space-x-4">
				<div class="avatar">
					<div class="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
						{#if user.photo_url}
							<img src={user.photo_url} alt={`Avatar de ${user.name} ${user.last_name}`} />
						{:else}
							<div class="flex items-center justify-center h-full bg-primary text-primary-content">
								<span class="text-2xl font-semibold">{getInitials(user.name, user.last_name)}</span>
							</div>
						{/if}
					</div>
				</div>
				<div class="flex-1">
					<h2 class="card-title text-2xl font-bold">{user.name} {user.last_name}</h2>
					<p class="text-sm">{user.email}</p>
					{#if user.phone}
						<p class="text-sm">Teléfono: {user.phone}</p>
					{/if}
				</div>
			</div>
			<div class="mt-4 flex gap-2">
				<span class="badge badge-secondary badge-md">{user.role}</span>
				<span class="badge badge-md {user.is_active ? 'badge-success' : 'badge-error'}">
					{user.is_active ? 'Activo' : 'Inactivo'}
				</span>
			</div>
			<div class="mt-4 text-sm">
				<p>Registrado: {formatDate(user.created_at)}</p>
				<p>Último inicio: {formatDate(user.last_sign_in_at)}</p>
			</div>
			<div class="card-actions justify-end mt-4">
				<button class="btn btn-primary btn-sm" onclick={() => openEditModal(user)}>Editar</button>
				<button class="btn btn-error btn-sm" onclick={() => openDeleteConfirmModal(user)}>
					<Trash class="w-4" />
				</button>
			</div>
		</div>
	</div>
{/snippet}
