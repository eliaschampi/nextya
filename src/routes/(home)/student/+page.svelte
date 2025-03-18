<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Message from '$lib/components/Message.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount, onDestroy } from 'svelte';
	import type { Student, Level } from '../../../app';
	import { Trash, Edit, Book, Search, UserPlus, UserSearch } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';

	// Reactive states with Svelte 5 runes
	let modal: HTMLDialogElement | null = $state(null);
	let confirmModal: HTMLDialogElement | null = $state(null);
	let isEditing = $state(false);
	let message = $state('');
	let selectedStudent = $state<Student | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<Student[]>([]);
	let levels = $state<Level[]>([]);
	let activeTab = $state<'search' | 'new'>('search');
	const groupOptions = ['A', 'B', 'C', 'D'];

	// Props using Svelte 5 $props
	const { data } = $props<{ data: { studentRegisters: Student[] } }>();

	// Search students via API
	async function searchStudents() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}
		const response = await fetch(`/api/search?search=${encodeURIComponent(searchQuery)}`);
		if (response.ok) searchResults = await response.json();
	}

	// Select a student from search results
	function selectStudent(student: Student) {
		selectedStudent = student;
		isEditing = true;
		searchQuery = '';
		searchResults = [];

		// Switch to the new student tab and fill the form
		activeTab = 'new';
	}

	// Modal handlers
	function openCreateModal() {
		isEditing = false;
		fetchLevels();
		selectedStudent = null;
		activeTab = 'search'; // Default to search tab when creating
		modal?.showModal();
	}

	function openEditModal(student: Student) {
		isEditing = true;
		fetchLevels();
		selectedStudent = student;
		activeTab = 'new'; // Go directly to form when editing
		modal?.showModal();
	}

	function openDeleteConfirmModal(student: Student) {
		selectedStudent = student;
		confirmModal?.showModal();
	}

	async function fetchLevels() {
		const response = await fetch('/api/levels');
		const data = await response.json();
		levels = data.levels;
	}

	// Form validation
	function validateForm(formData: FormData): boolean {
		const name = formData.get('name')?.toString().trim();
		const lastName = formData.get('last_name')?.toString().trim();
		const email = formData.get('email')?.toString().trim();
		const level = formData.get('level')?.toString().trim();
		const group = formData.get('group_name')?.toString().trim();

		if (!name || !lastName || !email || !level || !group) {
			message = 'All fields are required';
			return false;
		}
		message = '';
		return true;
	}

	// Handle form submission
	async function handleSubmit(event: Event) {
		event.preventDefault();
		const formElement = event.currentTarget as HTMLFormElement;
		const formData = new FormData(formElement);
		const action = isEditing ? 'update' : 'create';

		if (isEditing && selectedStudent) formData.append('code', selectedStudent.student_code);

		if (!validateForm(formData)) return;

		try {
			const response = await fetch(`?/${action}`, { method: 'POST', body: formData });
			const res = await response.json();

			if (res.type === 'success') {
				showToast(`${isEditing ? 'Student updated' : 'Student created'} successfully`, 'success');
				await invalidate('students:load');
				modal?.close();
			} else {
				message = responseMessage(res) || `Error ${isEditing ? 'updating' : 'creating'} student`;
			}
		} catch {
			message = 'Network error processing request';
		}
	}

	// Reset form on modal close
	function resetFormOnClose() {
		selectedStudent = null;
		message = '';
		searchQuery = '';
		searchResults = [];
		const form = modal?.querySelector('form');
		if (form) form.reset();
	}

	onMount(() => modal?.addEventListener('close', resetFormOnClose));
	onDestroy(() => modal?.removeEventListener('close', resetFormOnClose));

	// Handle deletion
	async function handleDelete() {
		if (!selectedStudent) return;
		const formData = new FormData();
		formData.append('code', selectedStudent.student_code);

		try {
			const response = await fetch('?/delete', { method: 'POST', body: formData });
			const res = await response.json();
			confirmModal?.close();

			if (res.type === 'success') {
				showToast('Student deleted successfully', 'success');
				await invalidate('students:load');
			} else {
				showToast(responseMessage(res) || 'Error deleting student', 'danger');
			}
		} catch {
			showToast('Network error deleting student', 'danger');
		}
	}

	// Format date for display
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
	<button class="btn btn-primary gap-2" onclick={openCreateModal}>
		<UserPlus class="w-4 h-4" />
		Agregar Estudiante
	</button>
</PageTitle>

<div class="card bg-base-200 w-full shadow rounded-xl">
	<div class="card-body p-0 sm:p-4">
		<div class="overflow-x-auto">
			<table class="table table-zebra w-full">
				<thead>
					<tr class="text-sm font-medium text-gray-600 bg-base-300">
						<th class="py-3 px-4">Nombre</th>
						<th class="py-3 px-4">Apellidos</th>
						<th class="py-3 px-4">Teléfono</th>
						<th class="py-3 px-4">Email</th>
						<th class="py-3 px-4">Nivel</th>
						<th class="py-3 px-4">Grupo</th>
						<th class="py-3 px-4">Estado</th>
						<th class="py-3 px-4">Creado</th>
						<th class="py-3 px-4 text-center">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each data.studentRegisters as student (student.code)}
						<tr class="hover:bg-base-300 transition-colors border-b border-base-300">
							<td class="py-3 px-4 font-medium">{student.name}</td>
							<td class="py-3 px-4">{student.last_name}</td>
							<td class="py-3 px-4">{student.phone || 'N/A'}</td>
							<td class="py-3 px-4 text-blue-600">{student.email}</td>
							<td class="py-3 px-4">
								<span class="badge badge-primary badge-outline">{student.level}</span>
							</td>
							<td class="py-3 px-4 text-center">
								<span class="badge badge-secondary">{student.group_name}</span>
							</td>
							<td class="py-3 px-4">
								<span
									class="badge {student.is_active
										? 'badge-success'
										: 'badge-error'} badge-sm px-3 py-1"
								>
									{student.is_active ? 'Activo' : 'Inactivo'}
								</span>
							</td>
							<td class="py-3 px-4 text-sm text-gray-500">{formatDate(student.created_at)}</td>
							<td class="py-3 px-4">
								<div class="flex gap-2 justify-center">
									<button
										class="btn btn-sm btn-primary btn-outline"
										onclick={() => openEditModal(student)}
										aria-label="Editar estudiante"
									>
										<Edit class="w-4 h-4" />
									</button>
									<button
										class="btn btn-sm btn-error btn-outline"
										onclick={() => openDeleteConfirmModal(student)}
										aria-label="Eliminar estudiante"
									>
										<Trash class="w-4 h-4" />
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
</div>

<!-- Create/Edit Modal -->
<dialog bind:this={modal} class="modal">
	<div class="modal-box max-w-2xl">
		<form method="dialog">
			<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
		</form>
		<h3 class="text-xl font-bold mb-4 flex items-center gap-2">
			{#if isEditing}
				<Edit class="w-5 h-5 text-primary" />
				Editar Estudiante
			{:else}
				<UserPlus class="w-5 h-5 text-primary" />
				Registrar Estudiante
			{/if}
		</h3>

		<!-- Modern Tabs -->
		<div class="tabs tabs-lifted mb-6">
			<button
				type="button"
				class="tab tab-bordered {activeTab === 'search' ? 'tab-active' : ''} {isEditing
					? 'opacity-50 cursor-not-allowed'
					: ''}"
				onclick={() => (isEditing ? null : (activeTab = 'search'))}
				disabled={isEditing}
			>
				<UserSearch class="w-4 h-4 mr-2" />
				Buscar Estudiante
			</button>
			<button
				type="button"
				class="tab tab-bordered {activeTab === 'new' ? 'tab-active' : ''}"
				onclick={() => (activeTab = 'new')}
			>
				<UserPlus class="w-4 h-4 mr-2" />
				{isEditing ? 'Editar' : 'Nuevo'} Estudiante
			</button>
		</div>

		<!-- Search Tab -->
		<div class="w-full {activeTab === 'search' ? 'block' : 'hidden'}">
			<div class="join w-full mb-3">
				<input
					type="text"
					placeholder="Buscar estudiante..."
					class="input input-bordered join-item flex-1"
					bind:value={searchQuery}
				/>
				<button class="btn btn-primary join-item" aria-label="Buscar" onclick={searchStudents}>
					<Search class="w-4 h-4" />
				</button>
			</div>
			{#if searchResults.length > 0}
				<div class="bg-base-200 rounded-lg border border-base-300 mt-2 max-h-48 overflow-y-auto">
					<ul class="divide-y divide-base-300">
						{#each searchResults as student (student.student_code)}
							<li>
								<button
									type="button"
									onclick={() => selectStudent(student)}
									class="w-full px-4 py-3 hover:bg-base-200 transition-colors flex justify-between items-center"
								>
									<div class="flex flex-col items-start">
										<span class="font-medium">{student.name} {student.last_name}</span>
										<span class="text-sm text-gray-500">{student.email}</span>
									</div>
									<span class="badge badge-primary">
										<Edit class="w-4 h-4" />
									</span>
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{:else}
				<div class="text-center py-4 bg-base-200 rounded-lg border border-base-300 mt-2">
					<p class="text-gray-500">Presione el botón de buscar para buscar un estudiante</p>
				</div>
			{/if}
		</div>

		<!-- New/Edit Student Form tab -->
		<div class={activeTab === 'new' ? 'block' : 'hidden'}>
			<form onsubmit={handleSubmit} autocomplete="off">
				<fieldset class="fieldset bg-base-200 border border-base-300 p-4 rounded-box">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label class="fieldset-legend" for="name">Nombre</label>
							<input
								id="name"
								name="name"
								type="text"
								class="input w-full validator"
								placeholder="Nombre"
								required
								value={selectedStudent?.name || ''}
							/>
						</div>

						<div>
							<label class="fieldset-legend" for="last_name">Apellidos</label>
							<input
								id="last_name"
								name="last_name"
								type="text"
								class="input w-full validator"
								placeholder="Apellidos"
								required
								value={selectedStudent?.last_name || ''}
							/>
						</div>

						<div>
							<label class="fieldset-legend" for="phone">Teléfono</label>
							<input
								id="phone"
								name="phone"
								type="text"
								class="input w-full validator"
								placeholder="Número de teléfono"
								value={selectedStudent?.phone || ''}
							/>
						</div>
						<div>
							<label class="fieldset-legend" for="email">Correo Electrónico</label>
							<input
								id="email"
								name="email"
								type="email"
								class="input w-full validator"
								placeholder="ejemplo@correo.com"
								required
								value={selectedStudent?.email || ''}
							/>
						</div>
						<div>
							<label class="fieldset-legend" for="level">Nivel</label>
							<select
								id="level"
								name="level"
								class="select w-full validator"
								required
								value={selectedStudent?.level || ''}
							>
								<option value="">Selecciona un nivel</option>
								{#each levels as level (level.code)}
									<option value={level.code}>{level.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="fieldset-legend" for="group_name">Grupo</label>
							<div class="flex flex-wrap gap-4 mt-2">
								{#each groupOptions as option (option)}
									<label class="label cursor-pointer">
										<input
											type="radio"
											name="group_name"
											value={option}
											class="radio radio-primary"
											required
											checked={selectedStudent?.group_name === option}
										/>
										<span class="label-text">{option}</span>
									</label>
								{/each}
							</div>
						</div>
					</div>
				</fieldset>
				{#if message}
					<Message description={message} type="warning" />
				{/if}
				<div class="modal-action mt-6">
					<button class="btn btn-primary" type="submit">
						{isEditing ? 'Actualizar y Registrar' : 'Guardar'}
					</button>
				</div>
			</form>
		</div>
	</div>
</dialog>

<!-- Delete Confirmation Modal -->
<dialog bind:this={confirmModal} class="modal">
	<div class="modal-box bg-base-200">
		<h3 class="text-xl font-bold flex items-center gap-2 text-error">
			<Trash class="w-5 h-5" />
			Confirmar Eliminación
		</h3>
		<div class="py-6 px-4 bg-base-100 rounded-lg mt-4 border border-base-300">
			<p class="mb-2">¿Estás seguro que deseas eliminar al estudiante?</p>
			<div class="p-4 bg-base-200 rounded-lg flex items-center gap-3 mt-2">
				<div class="avatar placeholder">
					<div class="bg-neutral text-neutral-content rounded-full w-12">
						<span class="text-lg">
							{selectedStudent?.name?.[0] || ''}{selectedStudent?.last_name?.[0] || ''}
						</span>
					</div>
				</div>
				<div>
					<p class="font-bold">{selectedStudent?.name} {selectedStudent?.last_name}</p>
					<p class="text-sm text-gray-500">{selectedStudent?.email}</p>
				</div>
			</div>
			<p class="text-sm text-error mt-4">Esta acción no se puede deshacer.</p>
		</div>
		<div class="modal-action">
			<button class="btn btn-outline" onclick={() => confirmModal?.close()}>Cancelar</button>
			<button class="btn btn-error" onclick={handleDelete}>
				<Trash class="w-4 h-4 mr-1" />
				Eliminar
			</button>
		</div>
	</div>
</dialog>
