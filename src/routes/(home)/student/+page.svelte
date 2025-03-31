<script lang="ts">
	import Message from '$lib/components/Message.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount, onDestroy } from 'svelte';
	import type { Level, RegisterStudent, SelectForDelete, Student } from '../../../app';
	import { Book, Pencil, Search, Trash2, UserPlus } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { formatDate } from '$lib/utils/formatDate';

	let modal: HTMLDialogElement | null = $state(null);
	let confirmModal: HTMLDialogElement | null = $state(null);
	let isEditing = $state(false);
	let message = $state('');
	let selectedCode = $state<string | null>(null);
	let selectForDelete = $state<SelectForDelete | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<Student[]>([]);
	let activeTab = $state<'search' | 'new'>('search');
	let selectedLevelCode = $state('');
	let selectedGroup = $state('');
	let students = $state<RegisterStudent[]>([]);

	let nameInput: HTMLInputElement | null = $state(null);
	let lastNameInput: HTMLInputElement | null = $state(null);
	let phoneInput: HTMLInputElement | null = $state(null);
	let emailInput: HTMLInputElement | null = $state(null);
	let levelSelect: HTMLSelectElement | null = $state(null);
	let groupSelect: HTMLSelectElement | null = $state(null);
	let rollCodeInput: HTMLInputElement | null = $state(null);

	const { data } = $props<{ data: { levels: Level[] } }>();
	const groupOptions = ['A', 'B', 'C', 'D'];

	async function fetchStudentsByFilter(group?: string) {
		if (group !== undefined) {
			selectedGroup = group;
		}
		if (!selectedLevelCode || !selectedGroup) {
			students = [];
			return;
		}
		const response = await fetch(`/api/student/${selectedLevelCode}/${selectedGroup}`);
		if (response.ok) students = await response.json();
	}

	function handleFillEmail() {
		if (nameInput?.value && emailInput) {
			emailInput.value = `${nameInput.value.toLowerCase()}@nextya.com`;
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			searchStudents();
		}
		if (event.key === 'Tab') {
			event.preventDefault();
			activeTab = 'new';
			queueMicrotask(() => {
				nameInput?.focus();
				fillRegisterData();
			});
		}
	}

	function handleOpenNewTab() {
		activeTab = 'new';
		queueMicrotask(() => {
			nameInput?.focus();
			fillRegisterData();
		});
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
		searchQuery = '';
		searchResults = [];
		selectedCode = student.code;
		activeTab = 'new';

		modal?.showModal();
		queueMicrotask(() => {
			if (nameInput) nameInput.value = student.name || '';
			if (lastNameInput) lastNameInput.value = student.last_name || '';
			if (phoneInput) phoneInput.value = student.phone || '';
			if (emailInput) emailInput.value = student.email || '';
			if (levelSelect) levelSelect.value = '';
			if (groupSelect) groupSelect.value = '';
		});
	}

	function fillRegisterData() {
		if (selectedLevelCode && levelSelect) {
			levelSelect.value = selectedLevelCode;
		}
		if (selectedGroup && groupSelect) {
			groupSelect.value = selectedGroup;
		}
	}
	function openCreateModal() {
		isEditing = false;
		selectedCode = null;
		activeTab = 'search';
		modal?.showModal();

		queueMicrotask(() => {
			const searchInput = modal?.querySelector<HTMLInputElement>('#searchq');
			searchInput?.focus();
		});
	}

	function openEditModal(item: RegisterStudent) {
		isEditing = true;
		selectedCode = item.student_code;
		activeTab = 'new';
		modal?.showModal();

		queueMicrotask(() => {
			if (nameInput) nameInput.value = item.name || '';
			if (lastNameInput) lastNameInput.value = item.last_name || '';
			if (phoneInput) phoneInput.value = item.phone || '';
			if (emailInput) emailInput.value = item.email || '';
			if (levelSelect) levelSelect.value = item.level_code || '';
			if (groupSelect) groupSelect.value = item.group_name || '';
			if (rollCodeInput) rollCodeInput.value = item.roll_code || '';
		});
	}

	function openDeleteConfirmModal(payload: RegisterStudent) {
		selectForDelete = {
			code: payload.student_code,
			register_code: payload.register_code,
			name: payload.name,
			mode: 'all'
		};
		confirmModal?.showModal();
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		const formData = new FormData();
		formData.append('name', nameInput?.value || '');
		formData.append('last_name', lastNameInput?.value || '');
		formData.append('phone', phoneInput?.value || '');
		formData.append('email', emailInput?.value || '');
		formData.append('level', levelSelect?.value || '');
		formData.append('group_name', groupSelect?.value || '');
		formData.append('roll_code', rollCodeInput?.value || '');

		if (selectedCode) {
			formData.append('code', selectedCode.toString());
		}

		const response = await fetch('?/create', { method: 'POST', body: formData });
		const res = await response.json();

		if (res.type === 'success') {
			showToast(
				`${selectedCode ? 'Estudiante actualizado' : 'Estudiante registrado'} exitosamente`,
				'success'
			);
			await fetchStudentsByFilter();
			modal?.close();
		} else {
			message =
				responseMessage(res) || `Error al ${selectedCode ? 'actualizar' : 'registrar'} estudiante`;
		}
	}

	function resetFormOnClose() {
		selectedCode = null;
		message = '';
		searchQuery = '';
		searchResults = [];
		if (nameInput) nameInput.value = '';
		if (lastNameInput) lastNameInput.value = '';
		if (phoneInput) phoneInput.value = '';
		if (emailInput) emailInput.value = '';
		if (levelSelect) levelSelect.value = '';
		if (groupSelect) groupSelect.value = '';
		if (rollCodeInput) rollCodeInput.value = '';
	}
	onMount(() => modal?.addEventListener('close', resetFormOnClose));
	onDestroy(() => modal?.removeEventListener('close', resetFormOnClose));

	async function handleDelete() {
		if (!selectForDelete) return;
		const formData = new FormData();
		formData.append('code', selectForDelete.code);
		formData.append('register_code', selectForDelete.register_code);
		formData.append('mode', selectForDelete.mode);
		const response = await fetch('?/delete', { method: 'POST', body: formData });
		const res = await response.json();
		confirmModal?.close();
		selectForDelete = null;
		if (res.type === 'success') {
			showToast('Estudiante eliminado exitosamente', 'success');
			await fetchStudentsByFilter();
		} else {
			showToast(responseMessage(res) || 'Error eliminando estudiante', 'danger');
		}
	}
</script>

<PageTitle title="Estudiantes" description="Selecciona un nivel y grupo para ver los estudiantes.">
	<button class="btn btn-primary gap-2" onclick={openCreateModal}>
		<UserPlus class="w-4 h-4" />
		Registrar
	</button>
</PageTitle>

<div class="p-4 bg-base-200 rounded-box mb-4 flex flex-col sm:flex-row items-center gap-4">
	<select
		class="select w-full sm:w-auto"
		bind:value={selectedLevelCode}
		onchange={() => fetchStudentsByFilter()}
	>
		<option value="" disabled selected>Selecciona un nivel</option>
		{#each data.levels as level (level.code)}
			<option value={level.code}>{level.name}</option>
		{/each}
	</select>
	{#if selectedLevelCode}
		<div class="filter">
			<input
				class="btn btn-primary btn-sm btn-outline filter-reset"
				type="radio"
				name="groups"
				aria-label="All"
				onclick={() => fetchStudentsByFilter('')}
			/>
			{#each groupOptions as group (group)}
				<input
					class="btn btn-primary btn-sm btn-outline"
					type="radio"
					name="groups"
					aria-label={group}
					value={group}
					onclick={() => fetchStudentsByFilter(group)}
				/>
			{/each}
		</div>
	{/if}
</div>

{#if selectedLevelCode && students.length > 0}
	<div
		class="card bg-gradient-to-br from-base-200 to-base-100 shadow hover:shadow-lg transition-shadow duration-300 border border-base-300/30 rounded-xl overflow-hidden"
	>
		<div class="card-body overflow-x-auto">
			<table class="table table-zebra w-full">
				<thead>
					<tr>
						<th>Codigo</th>
						<th>Nombre</th>
						<th>Apellido</th>
						<th>Telefono</th>
						<th>Nivel</th>
						<th>Grupo</th>
						<th>Fecha de registro</th>
						<th class="text-center">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each students as student (student.student_code)}
						<tr class="hover:bg-base-300 transition-colors border-b border-base-300">
							<td class="py-3 px-4 text-accent font-medium">{student.roll_code}</td>
							<td class="py-3 px-4 font-medium">{student.name}</td>
							<td class="py-3 px-4">{student.last_name}</td>
							<td class="py-3 px-4">{student.phone || 'N/A'}</td>
							<td class="py-3 px-4">
								<span class="badge badge-primary badge-outline">{student.level}</span>
							</td>
							<td class="py-3 px-4 text-center">
								<span class="badge badge-secondary">{student.group_name}</span>
							</td>
							<td class="py-3 px-4 text-sm text-gray-500">{formatDate(student.created_at)}</td>
							<td class="py-3 px-4">
								<div class="flex gap-2 justify-center">
									<button
										class="btn btn-sm btn-primary btn-outline"
										onclick={() => openEditModal(student)}
										aria-label="Editar estudiante"
									>
										<Pencil class="w-4 h-4" />
									</button>
									<button
										class="btn btn-sm btn-error btn-outline"
										onclick={() => openDeleteConfirmModal(student)}
										aria-label="Eliminar estudiante"
									>
										<Trash2 class="w-4 h-4" />
									</button>
									<button class="btn btn-sm btn-secondary btn-outline" aria-label="Ver matrículas">
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
{:else if selectedLevelCode}
	<p class="text-center py-4 opacity-50">No hay estudiantes en este nivel y grupo.</p>
{:else}
	<p class="text-center py-4 opacity-50">Selecciona un nivel y grupo para ver los estudiantes.</p>
{/if}

<dialog bind:this={modal} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold mb-4">
			{isEditing ? 'Editar' : selectedCode ? 'Registrar en nuevo nivel' : 'Registrar'} Estudiante
		</h3>
		<div class="tabs tabs-box mb-4">
			<button
				role="tab"
				class="tab {activeTab === 'search' && !isEditing && !selectedCode ? 'tab-active' : ''}"
				disabled={isEditing || selectedCode !== null}
				onclick={() => !isEditing && !selectedCode && (activeTab = 'search')}
				tabindex={0}
			>
				Buscar
			</button>
			<button
				role="tab"
				class="tab {activeTab === 'new' ? 'tab-active' : ''}"
				onclick={() => handleOpenNewTab()}
				tabindex={0}
			>
				{isEditing ? 'Editar' : selectedCode ? 'Nuevo registro' : 'Nuevo'}
			</button>
		</div>
		{#if activeTab === 'search' && !isEditing && !selectedCode}
			<div class="join w-full mb-4">
				<input
					id="searchq"
					type="text"
					placeholder="Buscar estudiante por nombre"
					class="input input-bordered join-item flex-1"
					bind:value={searchQuery}
					onkeydown={handleKeyDown}
				/>
				<button
					class="btn btn-primary join-item"
					onclick={searchStudents}
					disabled={!searchQuery.trim()}
				>
					<Search class="w-4 h-4" />
				</button>
			</div>
			{#if searchResults.length > 0}
				<ul class="space-y-2 max-h-48 overflow-y-auto p-4">
					{#each searchResults as student (student.code)}
						<li
							class="bg-base-200 p-3 rounded-box hover:bg-base-300 transition-colors cursor-pointer"
						>
							<button class="w-full text-left" onclick={() => selectStudent(student)}>
								{student.name}
								{student.last_name}
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="bg-base-200 p-3 rounded-box text-base-content/20">Estudiante no encontrado</div>
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
							class="input w-full validator"
							placeholder="Nombre"
							required
							bind:this={nameInput}
							onblur={() => handleFillEmail()}
						/>
					</div>
					<div>
						<label class="label font-medium" for="last_name">Apellidos</label>
						<input
							id="last_name"
							name="last_name"
							type="text"
							class="input w-full validator"
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
							class="input w-full validator"
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
							class="input w-full validator"
							placeholder="Email"
							required
							bind:this={emailInput}
						/>
					</div>
					<div>
						<label class="label font-medium" for="level">Nivel</label>
						<select
							id="level"
							name="level"
							class="select w-full validator"
							required
							bind:this={levelSelect}
						>
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
							class="select w-full validator"
							required
							bind:this={groupSelect}
						>
							<option value="">Selecciona un grupo</option>
							{#each groupOptions as group (group)}
								<option value={group}>{group}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="label font-medium" for="roll_code">Código de Matrícula</label>
						<input
							id="roll_code"
							name="roll_code"
							type="text"
							class="input w-full validator"
							placeholder="4 dígitos (ej: 0001)"
							required
							maxlength="4"
							pattern="\d*"
							bind:this={rollCodeInput}
						/>
						<small class="text-xs opacity-70 mt-1 block">Ingrese 4 dígitos (ej: 0001, 1234)</small>
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
						{isEditing ? 'Actualizar' : selectedCode ? 'Registrar' : 'Guardar'}
					</button>
				</div>
			</form>
		{/if}
	</div>
</dialog>

<dialog bind:this={confirmModal} class="modal">
	<div class="modal-box bg-base-200">
		<h3 class="text-lg font-bold mb-4">Confirmar eliminación</h3>
		<Message
			type="warning"
			description={`El estudiante "${selectForDelete?.name}" será eliminado`}
		/>
		<fieldset class="fieldset p-4 bg-base-100 border border-base-300 rounded-box w-full">
			<legend class="fieldset-legend">Opciones de eliminación</legend>
			<div class="flex flex-col gap-2">
				{#if selectForDelete}
					<label class="label cursor-pointer justify-start gap-2">
						<input
							type="radio"
							name="delete-option"
							class="radio radio-primary"
							value="only_register"
							bind:group={selectForDelete.mode}
						/>
						<span class="label-text">Eliminar solo el registro de matricula</span>
					</label>
					<label class="label cursor-pointer justify-start gap-2">
						<input
							type="radio"
							name="delete-option"
							class="radio radio-primary"
							value="all"
							bind:group={selectForDelete.mode}
						/>
						<span class="label-text">Eliminar registro y estudiante</span>
					</label>
				{/if}
			</div>
		</fieldset>
		<div class="modal-action flex justify-center gap-4">
			<button class="btn" onclick={() => confirmModal?.close()}>Cancelar</button>
			<button class="btn btn-error" onclick={handleDelete}>Eliminar</button>
		</div>
	</div>
</dialog>
