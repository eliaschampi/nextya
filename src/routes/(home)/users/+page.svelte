<script lang="ts">
	import type { User } from '../../../app';
	import { showToast } from '$lib/stores/Toast';
	import UserForm from './UserForm.svelte';
	import { invalidate } from '$app/navigation';
	import { Trash } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { getInitials } from '$lib/utils/initialName';
	import PageTitle from '$lib/components/PageTitle.svelte';

	// Recibimos los usuarios mediante props
	const { data } = $props<{ data: { users: User[] } }>();

	// Referencia al <dialog> que actuará como modal
	let modal: HTMLDialogElement | null = null;
	let modal2: HTMLDialogElement | null = null;

	// Variables para controlar el modo y el usuario a editar (si aplica)
	let formMode: 'create' | 'update' = $state('create');
	let selectedUser: User | null = $state(null);

	// Abre el modal para crear un nuevo usuario
	function openCreateModal() {
		formMode = 'create';
		selectedUser = null;
		modal?.showModal();
	}

	// Abre el modal para actualizar el usuario seleccionado
	function openUpdateModal(user: User) {
		formMode = 'update';
		selectedUser = user;
		modal?.showModal();
	}

	function openDeleteModal(user: User) {
		selectedUser = user;
		modal2?.showModal();
	}

	// Cierra el modal
	function closeModal() {
		modal?.close();
	}

	// Callback que se ejecuta al finalizar la operación en el formulario
	async function handleFormFinish(message: string, success: boolean) {
		showToast(message, success ? 'success' : 'danger');
		if (success) {
			await invalidate('users:load');
		}
		closeModal();
	}

	// Función para formatear fechas de forma legible
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('es-ES', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function handleDeleteUser(user_id: string | null) {
		if (!user_id) return;
		const dataToSend = new FormData();
		dataToSend.append('user_id', user_id);
		const response = await fetch('?/delete', {
			method: 'POST',
			body: dataToSend
		});
		const res = await response.json();
		modal2?.close();
		if (res.type === 'success') {
			showToast('Usuario eliminado exitosamente', 'success');
			await invalidate('users:load');
		} else {
			showToast(responseMessage(res) ?? '', 'danger');
		}
	}
</script>

<PageTitle
	title="Usuarios"
	description="Aquí encontrarás todas las usuarios disponibles en la aplicación."
>
	<!-- button to add -->
	<button class="btn btn-primary" onclick={openCreateModal}>Agregar Usuario</button>
</PageTitle>

<!-- Lista de usuarios -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
	{#each data.users as user (user.user_id)}
		<div class="card w-full bg-base-200 shadow">
			<div class="card-body p-6">
				<!-- Avatar y detalles principales -->
				<div class="flex items-center space-x-4">
					<div class="avatar">
						<div
							class="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 bg-base-200"
						>
							{#if user.photo_url}
								<img
									src={user.photo_url}
									alt={`Avatar de ${user.name} ${user.last_name}`}
									class="object-cover w-full h-full"
								/>
							{:else}
								<div
									class="flex items-center justify-center h-full bg-primary text-primary-content"
								>
									<span class="text-2xl font-semibold">
										{getInitials(user.name, user.last_name)}
									</span>
								</div>
							{/if}
						</div>
					</div>
					<div class="flex-1">
						<h2 class="card-title text-2xl font-bold text-base-content">
							{user.name}
							{user.last_name}
						</h2>
						<p class="text-sm">{user.email}</p>
						{#if user.phone}
							<p class="text-sm">Teléfono: {user.phone}</p>
						{/if}
					</div>
				</div>

				<!-- Badges de rol y estado -->
				<div class="mt-4 flex gap-2">
					<span class="badge badge-secondary badge-md font-medium px-3 py-1">
						{user.role}
					</span>
					<span
						class="badge badge-md font-medium px-3 py-1 {user.is_active
							? 'badge-success'
							: 'badge-error'}"
					>
						{user.is_active ? 'Activo' : 'Inactivo'}
					</span>
				</div>

				<!-- Fechas de registro e inicio -->
				<div class="mt-4 text-sm">
					<p>Registrado: {formatDate(user.created_at)}</p>
					<p>Último inicio: {formatDate(user.last_sign_in_at)}</p>
				</div>

				<!-- Botón para editar usuario -->
				<div class="card-actions justify-end mt-4">
					<button class="btn btn-primary btn-sm" onclick={() => openUpdateModal(user)}>
						Editar
					</button>
					<button
						class="btn btn-error btn-sm"
						aria-label="delete"
						onclick={() => openDeleteModal(user)}
					>
						<Trash class="w-4" />
					</button>
				</div>
			</div>
		</div>
	{/each}
</div>
<dialog bind:this={modal2} class="modal">
	<div class="modal-box">
		<div class="p-4">
			<h2 class="text-lg font-bold text-base-content">Eliminar usuario</h2>
			<p class="text-sm">
				¿Estás seguro de que deseas eliminar el usuario
				<strong>{selectedUser ? `${selectedUser.name} ${selectedUser.last_name}` : ''}</strong>?
			</p>
		</div>
		<div class="modal-action">
			<button class="btn btn-error" onclick={() => modal2?.close()}> Cancelar </button>
			<button
				class="btn btn-primary"
				onclick={() => handleDeleteUser(selectedUser ? selectedUser.user_id : '')}
				disabled={!selectedUser}
			>
				Eliminar
			</button>
		</div>
	</div>
</dialog>
<!-- Modal: dentro del dialog se renderiza el componente UserForm -->
<dialog bind:this={modal} class="modal">
	<UserForm
		mode={formMode}
		onFinish={handleFormFinish}
		{...formMode === 'update' && selectedUser ? { user: selectedUser } : {}}
	/>
</dialog>
