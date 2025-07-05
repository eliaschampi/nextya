<!-- src/routes/users/+page.svelte -->
<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import PermissionsModal from '$lib/components/PermissionsModal.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount, onDestroy } from 'svelte';
	import { Pencil, Lock, EllipsisVertical } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { getInitials } from '$lib/utils/initialName';
	import { formatDate } from '$lib/utils/formatDate';
	import type { Users } from '$lib/types';
	import { permissionsStore } from '$lib/stores/permissions';
	import { page } from '$app/state';

	// Estados y referencias
	let modal: HTMLDialogElement | null = $state(null);
	let confirmModal: HTMLDialogElement | null = $state(null);
	let passwordModal: HTMLDialogElement | null = $state(null);
	let isEditing = $state(false);
	let message = $state('');
	let passwordMessage = $state('');
	let selectedUser = $state<Users | null>(null);
	let showPermissionsModal = $state(false);
	let selectedAvatar = $state('avatar.svg');
	const passwordPattern = '^(?=.*[A-Z])(?=.*\\d).{8,}$';
	const { data } = $props<{ data: { users: Users[] } }>();

	// Available avatars
	const avatars = [
		{ src: 'avatar.svg', label: 'Default' },
		{ src: 'woman1.svg', label: 'Woman 1' },
		{ src: 'woman2.svg', label: 'Woman 2' },
		{ src: 'man1.svg', label: 'Man 1' },
		{ src: 'man2.svg', label: 'Man 2' }
	];

	// permissions
	const canRead = permissionsStore.has({ entity: 'users', action: 'read' });
	const mySelf = (userId: string) => {
		return userId === page.data.user?.code;
	};

	function openCreateModal() {
		isEditing = false;
		selectedAvatar = 'avatar.svg';
		modal?.showModal();
	}

	function openEditModal(user: Users) {
		isEditing = true;
		selectedUser = user;
		selectedAvatar = user.photo_url || 'avatar.svg';
		modal?.showModal();

		const nameInput = modal?.querySelector<HTMLInputElement>('#name');
		const lastnameInput = modal?.querySelector<HTMLInputElement>('#last_name');
		const emailInput = modal?.querySelector<HTMLInputElement>('#email');
		const passwordInput = modal?.querySelector<HTMLInputElement>('#password');

		if (nameInput) nameInput.value = user.name || '';
		if (lastnameInput) lastnameInput.value = user.last_name || '';
		if (emailInput) emailInput.value = user.email || '';
		if (passwordInput) passwordInput.value = '';
	}

	function openDeleteConfirmModal(user: Users) {
		selectedUser = user;
		confirmModal?.showModal();
	}

	function openPasswordModal(user: Users) {
		selectedUser = user;
		passwordMessage = '';
		passwordModal?.showModal();
	}

	function openPermissionsModal(user: Users) {
		selectedUser = user;
		showPermissionsModal = true;
	}

	// Reset permissions modal state when it's closed
	$effect(() => {
		if (!showPermissionsModal) {
			setTimeout(() => {
				if (!showPermissionsModal) {
					selectedUser = null;
				}
			}, 300); // Small delay to ensure the modal is properly closed
		}
	});

	// Validar formulario
	function validateForm(formData: FormData): boolean {
		const fields = ['name', 'last_name', 'email', 'password'];
		const [name, last_name, email, password] = fields.map((field) =>
			formData.get(field)?.toString().trim()
		);

		if (!name || !last_name || !email) {
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

	// Validar formulario de contraseña
	function validatePasswordForm(formData: FormData): boolean {
		const password = formData.get('password')?.toString().trim();
		const confirmPassword = formData.get('confirm_password')?.toString().trim();

		if (!password) {
			passwordMessage = 'La contraseña es obligatoria';
			return false;
		}
		if (password.length < 8) {
			passwordMessage = 'La contraseña debe tener al menos 8 caracteres';
			return false;
		}
		if (password !== confirmPassword) {
			passwordMessage = 'Las contraseñas no coinciden';
			return false;
		}
		passwordMessage = '';
		return true;
	}

	// Enviar datos (crear o editar)
	async function handleSubmit(event: Event) {
		event.preventDefault();

		const formElement = event.currentTarget as HTMLFormElement;
		const dataToSend = new FormData(formElement);
		const action: 'create' | 'update' = isEditing ? 'update' : 'create';

		// Add the selected avatar
		dataToSend.append('photo_url', selectedAvatar);

		if (isEditing) {
			dataToSend.append('user_id', selectedUser?.code || '');
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

	// Manejar actualización de contraseña
	async function handlePasswordUpdate(event: Event) {
		event.preventDefault();
		if (!selectedUser) return;

		const formElement = event.currentTarget as HTMLFormElement;
		const dataToSend = new FormData(formElement);
		dataToSend.append('user_id', selectedUser.code);

		if (!validatePasswordForm(dataToSend)) return;

		try {
			const response = await fetch('?/updatePassword', { method: 'POST', body: dataToSend });
			const res = await response.json();

			if (res.type === 'success') {
				showToast('Contraseña actualizada exitosamente', 'success');
				passwordModal?.close();
			} else {
				passwordMessage = responseMessage(res) || 'Error al actualizar la contraseña';
			}
		} catch {
			passwordMessage = 'Error de red al actualizar la contraseña';
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
		dataToSend.append('user_id', selectedUser.code);

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
</script>

<PageTitle title="Usuarios" description="Lista de usuarios disponibles en la aplicación.">
	{#if $canRead}
		<button class="btn btn-primary" onclick={openCreateModal}>Agregar Usuario</button>
	{/if}
</PageTitle>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
	{#each data.users as user (user.id)}
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
				{#if !isEditing}
					<label class="fieldset-legend" for="password">Contraseña</label>
					<input
						id="password"
						name="password"
						type="password"
						class="input w-full validator"
						placeholder="Contraseña"
						required
						aria-required="true"
					/>
				{/if}
				<div class="mt-4">
					<div class="fieldset-legend mb-2 block">Avatar</div>
					<div class="flex flex-wrap gap-3 justify-center">
						{#each avatars as avatar (avatar.src)}
							<label class="flex flex-col items-center cursor-pointer group">
								<input
									type="radio"
									name="avatar"
									value={avatar.src}
									class="hidden"
									checked={selectedAvatar === avatar.src}
									onchange={() => (selectedAvatar = avatar.src)}
								/>
								<div
									class={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${selectedAvatar === avatar.src ? 'border-secondary scale-110' : 'border-base-300 group-hover:border-primary/50'}`}
								>
									<img src={avatar.src} alt={avatar.label} class="w-full h-full object-cover" />
								</div>
							</label>
						{/each}
					</div>
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

<!-- Modal para cambiar contraseña -->
<dialog bind:this={passwordModal} class="modal">
	<div class="modal-box">
		<form onsubmit={handlePasswordUpdate} autocomplete="off">
			<h3 class="text-lg font-bold">Cambiar contraseña</h3>
			<p class="text-sm text-base-content/70 mb-4">
				Establece una nueva contraseña para {selectedUser?.name}
				{selectedUser?.last_name}
			</p>
			<fieldset class="fieldset bg-base-200 border border-base-300 p-4 rounded-box">
				<label class="fieldset-legend" for="new_password">Nueva contraseña</label>
				<input
					id="new_password"
					name="password"
					type="password"
					class="input w-full validator"
					pattern={passwordPattern}
					placeholder="Nueva contraseña"
					required
					aria-required="true"
				/>
				<div class="text-xs text-base-content/60 mt-1 mb-2">
					Mínimo 8 caracteres, al menos 1 mayúscula y 1 número
				</div>
				<label class="fieldset-legend" for="confirm_password">Confirmar contraseña</label>
				<input
					id="confirm_password"
					name="confirm_password"
					type="password"
					class="input w-full validator"
					placeholder="Confirmar contraseña"
					required
					aria-required="true"
				/>
			</fieldset>
			{#if passwordMessage}
				<div class="px-2 mt-2">
					<Message description={passwordMessage} type="warning" />
				</div>
			{/if}
			<div class="modal-action flex justify-center gap-2">
				<button class="btn btn-ghost" type="button" onclick={() => passwordModal?.close()}>
					Cancelar
				</button>
				<button class="btn btn-primary" type="submit">Actualizar contraseña</button>
			</div>
		</form>
	</div>
</dialog>

<!-- Componente modal de permisos -->
{#if selectedUser}
	<PermissionsModal
		user={selectedUser}
		open={showPermissionsModal}
		onClose={() => (showPermissionsModal = false)}
	/>
{/if}

{#snippet userCard(user: Users)}
	<div
		class="card bg-gradient-to-br from-base-200 to-base-100 shadow duration-300 border border-base-300/30 rounded-xl overflow-hidden"
	>
		<div class="card-body p-6 space-y-4">
			{#if $canRead}
				<div class="absolute top-4 right-4 dropdown dropdown-end">
					<div tabindex="0" role="button" class="cursor-pointer">
						<EllipsisVertical class="w-4 h-4" />
					</div>
					<ul class="dropdown-content menu bg-base-100 rounded-box z-10 w-52 p-2 shadow-sm">
						<li>
							<button onclick={() => openPermissionsModal(user)}>Gestionar Permisos</button>
						</li>
						<li>
							<button onclick={() => openDeleteConfirmModal(user)}>Eliminar</button>
						</li>
					</ul>
				</div>
			{/if}
			<!-- Header with avatar and name -->
			<div class="flex items-center gap-4">
				<div class="avatar relative">
					<div
						class="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-r from-primary/20 to-secondary/20 flex items-center justify-center ring-2 ring-offset-2 ring-offset-base-100 ring-primary/50"
					>
						{#if user.photo_url}
							<img
								src={null}
								alt="User profile"
								class="object-cover w-full h-full"
								loading="lazy"
							/>
						{:else}
							<span class="text-xl font-bold text-primary">
								{getInitials(user.name || '', user.last_name || '')}
							</span>
						{/if}
					</div>
					<!-- Online status indicator -->
					<div
						class="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-success border-2 border-base-100"
					></div>
				</div>

				<div class="flex-1 min-w-0">
					<h2 class="text-xl font-bold text-base-content truncate">
						{user.name}
						{user.last_name}
					</h2>
					<p class="text-sm text-base-content/70 truncate">{user.email}</p>
				</div>
			</div>

			<!-- Stats with icons -->
			<ul class="text-sm">
				<li class="flex items-center gap-2 text-base-content/50">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						></path>
					</svg>
					<span>Creado: {formatDate(user.created_at)}</span>
				</li>
				<li class="flex items-center gap-2 text-base-content/50">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<span>Ultimo Login: {formatDate(user.last_login || '')}</span>
				</li>
			</ul>

			<!-- Action buttons with subtle hover effects -->
			<div class="flex justify-end gap-2 pt-2">
				{#if mySelf(user.code) || $canRead}
					<button class="btn btn-sm btn-soft btn-primary" onclick={() => openEditModal(user)}>
						<Pencil class="w-4 h-4" />
					</button>
					<button
						class="btn btn-sm btn-soft btn-secondary"
						onclick={() => openPasswordModal(user)}
						title="Cambiar Contraseña"
					>
						<Lock class="w-4 h-4" />
					</button>
				{/if}
			</div>
		</div>
	</div>
{/snippet}
