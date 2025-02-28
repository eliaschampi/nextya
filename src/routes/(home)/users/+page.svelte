<!-- src/components/UserList.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { User } from '../../../app';
	import { showToast } from '$lib/stores/Toast';

	// Definimos la prop `data` con el tipo adecuado
	// export let data: { users: User[] };
	// lets use $props instead of data for this error

	const { data } = $props<{ data: { users: User[] } }>();

	let modal: HTMLDialogElement | null = null;

	let loading = $state(false);

	function openModal() {
		modal?.showModal();
	}

	// Datos del formulario (similar a "data" en Vue)
	let formData = $state({
		uname: '',
		ulastname: '',
		uemail: '',
		urole: 'user',
		ustatus: 'active'
	});

	function closeModal() {
		modal?.close();
		resetForm();
	}

	// Función para limpiar los datos del formulario
	function resetForm() {
		formData = {
			uname: '',
			ulastname: '',
			uemail: '',
			urole: 'user',
			ustatus: 'active'
		};
	}

	// Función para obtener las iniciales del nombre y apellido
	function getInitials(name: string, last_name: string): string {
		return `${name[0]}${last_name[0]}`.toUpperCase();
	}

	// Función para formatear fechas de manera legible
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('es-ES', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Envío del formulario con validación y manejo del loading
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		// Validación sencilla del lado cliente
		if (!formData.uname.trim() || !formData.ulastname.trim() || !formData.uemail.trim()) {
			showToast('Message sent successfully', 'success');
			return;
		}

		loading = true;

		// Se utiliza FormData para enviar los datos al action "createUser"
		const formElement = event.currentTarget as HTMLFormElement;
		const data = new FormData(formElement);

		try {
			const response = await fetch('?/create', {
				method: 'POST',
				body: data
			});

			if (response.ok) {
				// Éxito: se limpia el formulario, se cierra el modal y se refrescan datos (si aplica)
				resetForm();
				closeModal();
			} else {
				const { error } = await response.json();
				alert(error || 'Error al crear el usuario');
			}
		} catch (error) {
			console.error(error);
		}

		loading = false;
	}

	onMount(() => {
		modal?.addEventListener('close', resetForm);
	});
</script>

<!-- HTML -->
<h1 class="text-xl font-bold text-base-content">Usuarios</h1>

<!-- add button here left to add -->
<div class="flex justify-end">
	<button class="btn btn-primary" onclick={openModal}>Agregar Usuario</button>
</div>

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

				<!-- Badges para rol y estado -->
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

				<!-- Fechas de registro y último inicio -->
				<div class="mt-4 text-sm">
					<p>Registrado: {formatDate(user.created_at)}</p>
					<p>Último inicio: {formatDate(user.last_sign_in_at)}</p>
				</div>

				<!-- Botón de acción -->
				<div class="card-actions justify-end mt-4">
					<button class="btn btn-primary btn-sm">Ver Perfil</button>
				</div>
			</div>
		</div>
	{/each}
</div>

<dialog bind:this={modal} class="modal">
	<form onsubmit={handleSubmit} method="post" class="modal-box">
		<h3 class="text-lg font-bold">Agregar un nuevo usuario</h3>

		<!-- Fieldset: Datos del usuario -->
		<fieldset class="fieldset bg-base-200 border border-base-300 p-4 rounded-box">
			<legend class="fieldset-legend">Datos del usuario</legend>

			<label class="fieldset-label w-full" for="uname">Nombre</label>
			<input
				type="text"
				class="input w-full"
				placeholder="Nombre"
				id="uname"
				name="uname"
				bind:value={formData.uname}
			/>

			<label class="fieldset-label w-full" for="ulastname">Apellidos</label>
			<input
				type="text"
				class="input w-full"
				placeholder="Apellidos"
				id="ulastname"
				name="ulastname"
				bind:value={formData.ulastname}
			/>
		</fieldset>

		<!-- Fieldset: Datos de contacto -->
		<fieldset class="fieldset bg-base-200 border border-base-300 p-4 rounded-box">
			<legend class="fieldset-legend">Datos de contacto</legend>

			<label class="fieldset-label w-full" for="uemail">Correo electrónico</label>
			<input
				type="email"
				class="input w-full"
				placeholder="Correo electrónico"
				id="uemail"
				name="uemail"
				bind:value={formData.uemail}
			/>

			<label class="fieldset-label w-full" for="urole">Rol</label>
			<select class="select w-full" id="urole" name="urole" bind:value={formData.urole}>
				<option value="admin">Administrador</option>
				<option value="user">Usuario</option>
			</select>

			<label class="fieldset-label w-full" for="ustatus">Estado</label>
			<select class="select w-full" id="ustatus" name="ustatus" bind:value={formData.ustatus}>
				<option value="active">Activo</option>
				<option value="inactive">Inactivo</option>
			</select>
		</fieldset>

		<!-- Botones de cancelar y enviar -->
		<div class="flex justify-end mt-4">
			<button type="button" class="btn" onclick={closeModal}>Cancelar</button>
			<button type="submit" class="btn btn-primary" disabled={loading}>
				{#if loading}
					Cargando...
				{:else}
					Guardar
				{/if}
			</button>
		</div>
	</form>
</dialog>
