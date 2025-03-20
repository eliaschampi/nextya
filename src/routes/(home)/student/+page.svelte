<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount, onDestroy } from 'svelte';
	import type { Level, Student } from '../../../app';
	import { EllipsisVertical, Search, UserPlus } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';

	// Estados con runes
	let modal: HTMLDialogElement | null = $state(null);
	let confirmModal: HTMLDialogElement | null = $state(null);
	let isEditing = $state(false);
	let message = $state('');
	let selectedStudent = $state<Student | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<Student[]>([]);
	let activeTab = $state<'search' | 'new'>('search');
	let selectedLevelCode = $state('');
	let selectedGroup = $state('C');
	let students = $state<Student[]>([]);

	// Referencias al DOM para los inputs
	let nameInput: HTMLInputElement | null = $state(null);
	let lastNameInput: HTMLInputElement | null = $state(null);
	let phoneInput: HTMLInputElement | null = $state(null);
	let emailInput: HTMLInputElement | null = $state(null);
	let levelSelect: HTMLSelectElement | null = $state(null);
	let groupSelect: HTMLSelectElement | null = $state(null);

	const { data } = $props<{ data: { levels: Level[] } }>();
	const groupOptions = ['A', 'B', 'C', 'D'];

	async function fetchStudents() {
		// folder is /src/api/student/[level]/[group]
		const response = await fetch(`/api/student/${selectedLevelCode}/${selectedGroup}`);
		if (response.ok) students = await response.json();
		console.log(students);
	}

	async function updateLevelFilter() {
		fetchStudents();
	}

	// Buscar estudiantes
	async function searchStudents() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}
		const response = await fetch(`/api/student?search=${encodeURIComponent(searchQuery)}`);
		if (response.ok) searchResults = await response.json();
	}

	// Seleccionar estudiante de los resultados
	function selectStudent(student: Student) {
		selectedStudent = student;
		isEditing = true;
		activeTab = 'new';
		searchQuery = '';
		searchResults = [];
		openEditModal(student);
	}

	// Abrir modal para crear
	function openCreateModal() {
		isEditing = false;
		selectedStudent = null;
		activeTab = 'search';
		modal?.showModal();
	}

	// Abrir modal para editar y establecer valores en los inputs
	function openEditModal(student: Student) {
		isEditing = true;
		selectedStudent = student;
		activeTab = 'new';
		modal?.showModal();

		if (nameInput) nameInput.value = student.name || '';
		if (lastNameInput) lastNameInput.value = student.last_name || '';
		if (phoneInput) phoneInput.value = student.phone || '';
		if (emailInput) emailInput.value = student.email || '';
		if (levelSelect) levelSelect.value = student.level_code || '';
		if (groupSelect) groupSelect.value = student.group_name || '';
	}

	// Abrir modal de confirmación para eliminar
	function openDeleteConfirmModal(student: Student) {
		selectedStudent = student;
		confirmModal?.showModal();
	}

	// Validar formulario
	function validateForm(): boolean {
		if (
			!nameInput?.value.trim() ||
			!lastNameInput?.value.trim() ||
			!emailInput?.value.trim() ||
			!levelSelect?.value ||
			!groupSelect?.value
		) {
			message = 'Todos los campos son obligatorios';
			return false;
		}
		message = '';
		return true;
	}

	// Enviar formulario
	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!validateForm()) return;

		const formData = new FormData();
		formData.append('name', nameInput?.value || '');
		formData.append('last_name', lastNameInput?.value || '');
		formData.append('phone', phoneInput?.value || '');
		formData.append('email', emailInput?.value || '');
		formData.append('level', levelSelect?.value || '');
		formData.append('group_name', groupSelect?.value || '');
		if (isEditing && selectedStudent) formData.append('code', selectedStudent.student_code);

		const action = isEditing ? 'update' : 'create';
		const response = await fetch(`?/${action}`, { method: 'POST', body: formData });
		const res = await response.json();

		if (res.type === 'success') {
			showToast(
				`${isEditing ? 'Estudiante actualizado' : 'Estudiante registrado'} exitosamente`,
				'success'
			);
			fetchStudents();
			modal?.close();
		} else {
			message =
				responseMessage(res) || `Error al ${isEditing ? 'actualizar' : 'registrar'} estudiante`;
		}
	}

	// Reiniciar formulario al cerrar modal
	function resetFormOnClose() {
		selectedStudent = null;
		message = '';
		searchQuery = '';
		searchResults = [];
		if (nameInput) nameInput.value = '';
		if (lastNameInput) lastNameInput.value = '';
		if (phoneInput) phoneInput.value = '';
		if (emailInput) emailInput.value = '';
		if (levelSelect) levelSelect.value = '';
		if (groupSelect) groupSelect.value = '';
	}
	onMount(() => modal?.addEventListener('close', resetFormOnClose));
	onDestroy(() => modal?.removeEventListener('close', resetFormOnClose));

	// Eliminar estudiante
	async function handleDelete() {
		if (!selectedStudent) return;
		const formData = new FormData();
		formData.append('code', selectedStudent.student_code);

		const response = await fetch('?/delete', { method: 'POST', body: formData });
		const res = await response.json();
		confirmModal?.close();

		if (res.type === 'success') {
			showToast('Estudiante eliminado exitosamente', 'success');
			await invalidate('students:load');
		} else {
			showToast(responseMessage(res) || 'Error eliminando estudiante', 'danger');
		}
	}
</script>

<PageTitle title="Estudiantes" description="Selecciona un nivel para ver los estudiantes.">
	<button class="btn btn-primary gap-2" onclick={openCreateModal}>
		<UserPlus class="w-4 h-4" />
		Registrar Estudiante
	</button>
</PageTitle>

<!-- Selector de nivel -->
<div class="p-4 bg-base-200 rounded-box mb-4">
	<select
		class="select select-bordered w-full max-w-xs"
		bind:value={selectedLevelCode}
		onchange={updateLevelFilter}
	>
		<option value="">Selecciona un nivel</option>
		{#each data.levels as level (level.code)}
			<option value={level.code}>{level.name}</option>
		{/each}
	</select>
</div>

<!-- Tabla de estudiantes -->
{#if selectedLevelCode && students.length > 0}
	<div class="overflow-x-auto">
		<table class="table table-zebra w-full">
			<thead>
				<tr class="text-sm font-medium text-gray-600 bg-base-300">
					<th class="py-3 px-4">Nombre</th>
					<th class="py-3 px-4">Apellidos</th>
					<th class="py-3 px-4">Email</th>
					<th class="py-3 px-4">Teléfono</th>
					<th class="py-3 px-4">Grupo</th>
					<th class="py-3 px-4 text-center">Acciones</th>
				</tr>
			</thead>
			<tbody>
				{#each data.students as student (student.student_code)}
					<tr class="hover:bg-base-300 transition-colors border-b border-base-300">
						<td class="py-3 px-4">{student.name}</td>
						<td class="py-3 px-4">{student.last_name}</td>
						<td class="py-3 px-4">{student.email}</td>
						<td class="py-3 px-4">{student.phone || 'N/A'}</td>
						<td class="py-3 px-4">{student.group_name}</td>
						<td class="py-3 px-4 text-center">
							<div class="dropdown dropdown-end">
								<div tabindex="0" role="button" class="m-1 cursor-pointer">
									<EllipsisVertical class="w-4 h-4" />
								</div>
								<ul class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
									<li><button onclick={() => openEditModal(student)}>Editar</button></li>
									<li><button onclick={() => openDeleteConfirmModal(student)}>Eliminar</button></li>
								</ul>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if selectedLevelCode}
	<p class="text-center py-4">No hay estudiantes en este nivel.</p>
{:else}
	<p class="text-center py-4">Selecciona un nivel para ver los estudiantes.</p>
{/if}

<!-- Modal para crear/editar -->
<dialog bind:this={modal} class="modal">
	<div class="modal-box max-w-2xl">
		<h3 class="text-lg font-bold">{isEditing ? 'Editar' : 'Registrar'} Estudiante</h3>

		<!-- Pestañas -->
		<div class="tabs tabs-boxed mb-4">
			<button
				class="tab {activeTab === 'search' && !isEditing ? 'tab-active' : ''}"
				disabled={isEditing}
				onclick={() => !isEditing && (activeTab = 'search')}
			>
				Buscar
			</button>
			<button
				class="tab {activeTab === 'new' ? 'tab-active' : ''}"
				onclick={() => (activeTab = 'new')}
			>
				{isEditing ? 'Editar' : 'Nuevo'}
			</button>
		</div>

		<!-- Pestaña de búsqueda -->
		{#if activeTab === 'search' && !isEditing}
			<div class="join w-full mb-4">
				<input
					type="text"
					placeholder="Buscar estudiante por nombre o email..."
					class="input input-bordered join-item flex-1"
					bind:value={searchQuery}
					oninput={searchStudents}
				/>
				<button class="btn btn-primary join-item" onclick={searchStudents}>
					<Search class="w-4 h-4" />
				</button>
			</div>
			{#if searchResults.length > 0}
				<ul class="space-y-2 max-h-48 overflow-y-auto">
					{#each searchResults as student (student.student_code)}
						<li class="bg-base-200 p-2 rounded-box hover:bg-base-300 transition-colors">
							<button class="w-full text-left" onclick={() => selectStudent(student)}>
								{student.name}
								{student.last_name} ({student.email})
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}

		<!-- Pestaña de formulario -->
		{#if activeTab === 'new'}
			<form onsubmit={handleSubmit} autocomplete="off">
				<fieldset
					class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-base-200 p-4 rounded-box border border-base-300"
				>
					<div>
						<label class="label" for="name">Nombre</label>
						<input
							id="name"
							name="name"
							type="text"
							class="input w-full"
							placeholder="Nombre"
							required
							bind:this={nameInput}
						/>
					</div>
					<div>
						<label class="label" for="last_name">Apellidos</label>
						<input
							id="last_name"
							name="last_name"
							type="text"
							class="input w-full"
							placeholder="Apellidos"
							required
							bind:this={lastNameInput}
						/>
					</div>
					<div>
						<label class="label" for="phone">Teléfono</label>
						<input
							id="phone"
							name="phone"
							type="text"
							class="input w-full"
							placeholder="Teléfono"
							bind:this={phoneInput}
						/>
					</div>
					<div>
						<label class="label" for="email">Email</label>
						<input
							id="email"
							name="email"
							type="email"
							class="input w-full"
							placeholder="Email"
							required
							bind:this={emailInput}
						/>
					</div>
					<div>
						<label class="label" for="level">Nivel</label>
						<select id="level" name="level" class="select w-full" required bind:this={levelSelect}>
							<option value="">Selecciona un nivel</option>
							{#each data.levels as level (level.code)}
								<option value={level.code}>{level.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label" for="group_name">Grupo</label>
						<select
							id="group_name"
							name="group_name"
							class="select w-full"
							required
							bind:this={groupSelect}
						>
							<option value="">Selecciona un grupo</option>
							{#each groupOptions as group (group)}
								<option value={group}>{group}</option>
							{/each}
						</select>
					</div>
				</fieldset>
				{#if message}
					<div class="mt-4">
						<Message description={message} type="warning" />
					</div>
				{/if}
				<div class="modal-action flex justify-center gap-2 mt-4">
					<button class="btn btn-error" type="button" onclick={() => modal?.close()}>
						Cancelar
					</button>
					<button class="btn btn-primary" type="submit">
						{isEditing ? 'Actualizar' : 'Guardar'}
					</button>
				</div>
			</form>
		{/if}
	</div>
</dialog>

<!-- Modal de confirmación -->
<dialog bind:this={confirmModal} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Confirmar eliminación</h3>
		<p class="py-4">
			¿Estás seguro que deseas eliminar a "{selectedStudent?.name}
			{selectedStudent?.last_name}"?
		</p>
		<div class="modal-action flex justify-center gap-2">
			<button class="btn" onclick={() => confirmModal?.close()}>Cancelar</button>
			<button class="btn btn-error" onclick={handleDelete}>Eliminar</button>
		</div>
	</div>
</dialog>
