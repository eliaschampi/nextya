<script lang="ts">
	// routes/(home)/student/+page.svelte
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount, onDestroy } from 'svelte';
	import type { Student } from '../../../app';
	import { Trash, Edit, Book } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';

	// Estados y referencias
	let modal: HTMLDialogElement | null = $state(null);
	let confirmModal: HTMLDialogElement | null = $state(null);
	let isEditing = $state(false);
	let message = $state('');
	let selectedStudent = $state<Student | null>(null);

	const { data } = $props<{ data: { students: Student[] } }>();

	// Abrir modal para crear
	function openCreateModal() {
		isEditing = false;
		modal?.showModal();
	}

	// Abrir modal para editar
	function openEditModal(student: Student) {
		isEditing = true;
		selectedStudent = student;
		modal?.showModal();

		const codeInput = modal?.querySelector<HTMLInputElement>('#code');
		const nameInput = modal?.querySelector<HTMLInputElement>('#name');
		const lastnameInput = modal?.querySelector<HTMLInputElement>('#last_name');
		const phoneInput = modal?.querySelector<HTMLInputElement>('#phone');
		const emailInput = modal?.querySelector<HTMLInputElement>('#email');
		const isActiveInput = modal?.querySelector<HTMLInputElement>('#is_active');

		if (codeInput) codeInput.value = student.code || '';
		if (nameInput) nameInput.value = student.name || '';
		if (lastnameInput) lastnameInput.value = student.last_name || '';
		if (phoneInput) phoneInput.value = student.phone || '';
		if (emailInput) emailInput.value = student.email || '';
		if (isActiveInput) isActiveInput.checked = student.is_active ?? false;
	}

	// Abrir modal para confirmar eliminación
	function openDeleteConfirmModal(student: Student) {
		selectedStudent = student;
		confirmModal?.showModal();
	}

	// Validar formulario
	function validateForm(formData: FormData): boolean {
		const name = (formData.get('name') as string)?.trim();
		const lastName = (formData.get('last_name') as string)?.trim();
		const email = (formData.get('email') as string)?.trim();

		if (!name || !lastName || !email) {
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
			dataToSend.append('code', selectedStudent?.code || '');
		}

		if (!validateForm(dataToSend)) return;

		try {
			const response = await fetch(`?/${action}`, { method: 'POST', body: dataToSend });
			const res = await response.json();

			if (res.type === 'success') {
				showToast(
					`${isEditing ? 'Estudiante actualizado' : 'Estudiante creado'} exitosamente`,
					'success'
				);
				await invalidate('students:load');
				modal?.close();
			} else {
				message =
					responseMessage(res) || `Error al ${isEditing ? 'actualizar' : 'crear'} el estudiante`;
			}
		} catch {
			message = 'Error de red al procesar la solicitud';
		}
	}

	// Reiniciar formulario al cerrar modal
	function resetFormOnClose() {
		selectedStudent = null;
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
		if (!selectedStudent) return;

		const dataToSend = new FormData();
		dataToSend.append('code', selectedStudent.code);

		try {
			const response = await fetch('?/delete', { method: 'POST', body: dataToSend });
			const res = await response.json();
			confirmModal?.close();

			if (res.type === 'success') {
				showToast('Estudiante eliminado exitosamente', 'success');
				await invalidate('students:load');
			} else {
				showToast(responseMessage(res) || 'Error al eliminar el estudiante', 'danger');
			}
		} catch {
			showToast('Error de red al eliminar el estudiante', 'danger');
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

<PageTitle title="Estudiantes" description="Lista de estudiantes disponibles.">
	<button class="btn btn-primary" onclick={openCreateModal}>Agregar Estudiante</button>
</PageTitle>

<div class="card bg-base-200 w-full">
	<div class="card-body overflow-x-auto">
		<table class="table table-zebra w-full hover">
			<thead>
				<tr class="text-sm text-gray-600 uppercase">
					<th class="py-3 px-4">Nombre</th>
					<th class="py-3 px-4">Apellidos</th>
					<th class="py-3 px-4">Teléfono</th>
					<th class="py-3 px-4">Email</th>
					<th class="py-3 px-4">Estado</th>
					<th class="py-3 px-4">Creado</th>
					<th class="py-3 px-4">Acciones</th>
				</tr>
			</thead>
			<tbody>
				{#each data.students as student (student.code)}
					<tr class="hover:bg-base-300 transition-colors">
						<td class="py-3 px-4">{student.name}</td>
						<td class="py-3 px-4">{student.last_name}</td>
						<td class="py-3 px-4">{student.phone || 'N/A'}</td>
						<td class="py-3 px-4">{student.email}</td>
						<td class="py-3 px-4">
							<span class="badge {student.is_active ? 'badge-success' : 'badge-error'}">
								{student.is_active ? 'Activo' : 'Inactivo'}
							</span>
						</td>
						<td class="py-3 px-4">{formatDate(student.created_at)}</td>
						<td class="py-3 px-4">
							<div class="flex gap-2">
								<button
									class="btn btn-sm btn-primary"
									onclick={() => openEditModal(student)}
									aria-label="Editar estudiante"
								>
									<Edit class="w-4 h-4" />
								</button>
								<button
									class="btn btn-sm btn-error"
									onclick={() => openDeleteConfirmModal(student)}
									aria-label="Eliminar estudiante"
								>
									<Trash class="w-4 h-4" />
								</button>
								<button class="btn btn-sm btn-secondary" aria-label="Ver matrículas">
									<Book class="w-4 h-4" />
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<!-- Modal para crear o editar -->
<dialog bind:this={modal} class="modal">
	<div class="modal-box">
		<form onsubmit={handleSubmit} autocomplete="off">
			<h3 class="text-lg font-bold">{isEditing ? 'Editar' : 'Crear'} estudiante</h3>
			<fieldset class="fieldset bg-base-200 border border-base-300 p-4 rounded-box mt-4">
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
				<label class="fieldset-legend" for="phone">Teléfono</label>
				<input
					id="phone"
					name="phone"
					type="text"
					class="input w-full validator"
					placeholder="Teléfono"
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
				<label class="fieldset-legend" for="is_active">Estado</label>
				<input id="is_active" name="is_active" type="checkbox" class="toggle toggle-primary" />
			</fieldset>
			{#if message}
				<div class="px-2 mt-2">
					<Message description={message} type="warning" />
				</div>
			{/if}
			<div class="modal-action flex justify-center gap-2 mt-4">
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
			¿Estás seguro de eliminar a "{selectedStudent?.name}
			{selectedStudent?.last_name}"?
		</p>
		<div class="modal-action flex justify-center gap-2">
			<button class="btn" onclick={() => confirmModal?.close()}>Cancelar</button>
			<button class="btn btn-error" onclick={handleDelete}>Eliminar</button>
		</div>
	</div>
</dialog>
