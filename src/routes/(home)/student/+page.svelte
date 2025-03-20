<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount, onDestroy } from 'svelte';
	import type { Level, Student } from '../../../app';
	import { Pencil, Search, Trash2, UserPlus } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';

	let modal: HTMLDialogElement | null = $state(null);
	let confirmModal: HTMLDialogElement | null = $state(null);
	let isEditing = $state(false);
	let message = $state('');
	let selectedStudent = $state<Student | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<Student[]>([]);
	let activeTab = $state<'search' | 'new'>('search');
	let selectedLevelCode = $state('');
	let selectedGroup = $state('');
	let students = $state<Student[]>([]);

	let nameInput: HTMLInputElement | null = $state(null);
	let lastNameInput: HTMLInputElement | null = $state(null);
	let phoneInput: HTMLInputElement | null = $state(null);
	let emailInput: HTMLInputElement | null = $state(null);
	let levelSelect: HTMLSelectElement | null = $state(null);
	let groupSelect: HTMLSelectElement | null = $state(null);

	const { data } = $props<{ data: { levels: Level[] } }>();
	const groupOptions = ['A', 'B', 'C', 'D'];

	async function updateLevelFilter() {
		if (!selectedLevelCode || !selectedGroup) {
			students = [];
			return;
		}
		const response = await fetch(`/api/student/${selectedLevelCode}/${selectedGroup}`);
		if (response.ok) students = await response.json();
	}

	async function searchStudents() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}
		const response = await fetch(`/api/student?search=${encodeURIComponent(searchQuery)}`);
		if (response.ok) searchResults = await response.json();
	}

	function selectStudent(student: Student) {
		selectedStudent = student;
		isEditing = true;
		activeTab = 'new';
		searchQuery = '';
		searchResults = [];
		openEditModal(student);
	}

	function openCreateModal() {
		isEditing = false;
		selectedStudent = null;
		activeTab = 'search';
		modal?.showModal();
	}

	function openEditModal(student: Student) {
		isEditing = true;
		selectedStudent = student;
		activeTab = 'new';
		modal?.showModal();

		setTimeout(() => {
			if (nameInput) nameInput.value = student.name || '';
			if (lastNameInput) lastNameInput.value = student.last_name || '';
			if (phoneInput) phoneInput.value = student.phone || '';
			if (emailInput) emailInput.value = student.email || '';
			if (levelSelect) levelSelect.value = student.level_code || '';
			if (groupSelect) groupSelect.value = student.group_name || '';
		}, 0);
	}

	function openDeleteConfirmModal(student: Student) {
		selectedStudent = student;
		confirmModal?.showModal();
	}

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
			await updateLevelFilter();
			modal?.close();
		} else {
			message =
				responseMessage(res) || `Error al ${isEditing ? 'actualizar' : 'registrar'} estudiante`;
		}
	}

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

<PageTitle title="Estudiantes" description="Selecciona un nivel y grupo para ver los estudiantes.">
	<button class="btn btn-primary gap-2" onclick={openCreateModal}>
		<UserPlus class="w-4 h-4" />
		Registrar Estudiante
	</button>
</PageTitle>

<div class="p-4 bg-base-200 rounded-box mb-4 flex flex-col sm:flex-row gap-4">
	<select
		class="select select-bordered w-full sm:w-auto"
		bind:value={selectedLevelCode}
		onchange={updateLevelFilter}
	>
		<option value="">Selecciona un nivel</option>
		{#each data.levels as level (level.code)}
			<option value={level.code}>{level.name}</option>
		{/each}
	</select>
	<select
		class="select select-bordered w-full sm:w-auto"
		bind:value={selectedGroup}
		disabled={!selectedLevelCode}
		onchange={updateLevelFilter}
	>
		<option value="">Selecciona un grupo</option>
		{#each groupOptions as group (group)}
			<option value={group}>{group}</option>
		{/each}
	</select>
</div>

{#if selectedLevelCode && students.length > 0}
	<div class="card bg-base-200 shadow">
		<div class="card-body">
			<table class="table table-zebra w-full">
				<thead>
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each students as student (student.student_code)}
						<tr class="hover:bg-base-200">
							<td class="py-3 px-4">{student.name}</td>
							<td class="py-3 px-4">{student.email}</td>
							<td class="py-3 px-4 text-center space-x-2">
								<button
									class="btn btn-ghost btn-sm tooltip"
									data-tip="Edit"
									onclick={() => openEditModal(student)}
								>
									<Pencil class="w-4 h-4 text-gray-500 hover:text-primary" />
								</button>
								<button
									class="btn btn-ghost btn-sm tooltip"
									data-tip="Delete"
									onclick={() => openDeleteConfirmModal(student)}
								>
									<Trash2 class="w-4 h-4 text-gray-500 hover:text-error" />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{:else if selectedLevelCode}
	<p class="text-center py-4">No hay estudiantes en este nivel y grupo.</p>
{:else}
	<p class="text-center py-4">Selecciona un nivel y grupo para ver los estudiantes.</p>
{/if}

<dialog bind:this={modal} class="modal">
	<div class="modal-box max-w-3xl">
		<h3 class="text-lg font-bold mb-4">{isEditing ? 'Editar' : 'Registrar'} Estudiante</h3>

		<div class="tabs tabs-lifted mb-4">
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

		{#if activeTab === 'search' && !isEditing}
			<div class="join w-full mb-4">
				<input
					type="text"
					placeholder="Buscar estudiante por nombre o email..."
					class="input input-bordered join-item flex-1"
					bind:value={searchQuery}
				/>
				<button class="btn btn-primary join-item" onclick={searchStudents}>
					<Search class="w-4 h-4" />
				</button>
			</div>
			{#if searchResults.length > 0}
				<ul class="space-y-2 max-h-48 overflow-y-auto">
					{#each searchResults as student (student.student_code)}
						<li
							class="bg-base-200 p-3 rounded-box hover:bg-base-300 transition-colors cursor-pointer"
						>
							<button class="w-full text-left" onclick={() => selectStudent(student)}>
								{student.name}
								{student.last_name} ({student.email})
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}

		{#if activeTab === 'new'}
			<form onsubmit={handleSubmit} autocomplete="off">
				<fieldset
					class="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-box border border-base-300 bg-base-200"
				>
					<div>
						<label class="label font-medium" for="name">Nombre</label>
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
						<label class="label font-medium" for="last_name">Apellidos</label>
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
						<label class="label font-medium" for="phone">Teléfono</label>
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
						<label class="label font-medium" for="email">Email</label>
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
						<label class="label font-medium" for="level">Nivel</label>
						<select id="level" name="level" class="select w-full" required bind:this={levelSelect}>
							<option value="">Selecciona un nivel</option>
							{#each data.levels as level (level.code)}
								<option value={level.code}>{level.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label font-medium" for="group_name">Grupo</label>
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
				<div class="modal-action flex justify-center gap-4 mt-6">
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

<dialog bind:this={confirmModal} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Confirmar eliminación</h3>
		<p class="py-4">
			¿Estás seguro que deseas eliminar al estudiante "{selectedStudent?.name}
			{selectedStudent?.last_name}" (Email: {selectedStudent?.email})?
		</p>
		<div class="modal-action flex justify-center gap-4">
			<button class="btn" onclick={() => confirmModal?.close()}>Cancelar</button>
			<button class="btn btn-error" onclick={handleDelete}>Eliminar</button>
		</div>
	</div>
</dialog>
