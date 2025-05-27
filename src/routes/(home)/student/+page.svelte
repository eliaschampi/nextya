<script lang="ts">
	import Message from '$lib/components/Message.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Table from '$lib/components/Table.svelte';
	import RegistersModal from '$lib/components/RegistersModal.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount } from 'svelte';
	import type { Level, RegisterStudent, SelectForDelete, Student } from '$lib/types';
	import type { TableColumn } from '$lib/types/table';
	// Define EventListener type
	type EventListener = (event: Event) => void;
	import { Search, UserPlus } from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { formatDate } from '$lib/utils/formatDate';
	import { permissionsStore } from '$lib/stores/permissions';

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

	// Estado para el modal de matrículas
	let registersModalOpen = $state(false);
	let selectedStudentForRegisters = $state<{ code: string; name: string } | null>(null);

	// Pagination state
	let currentPage = $state(1);
	let pageSize = $state(20); // Resultados por página

	// Filtered students based on search query
	const filteredStudents = $derived(
		students.filter((student) => {
			if (!searchQuery.trim()) return true;

			const query = searchQuery.toLowerCase();
			return (
				student.name?.toLowerCase().includes(query) ||
				student.last_name?.toLowerCase().includes(query) ||
				student.roll_code?.toLowerCase().includes(query) ||
				student.phone?.toLowerCase().includes(query)
			);
		})
	);

	// Resultados paginados
	const paginatedStudents = $derived(
		filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	// Total de páginas
	const totalPages = $derived(Math.ceil(filteredStudents.length / pageSize));

	// Función para cambiar de página
	function goToPage(page: number) {
		if (page < 1 || page > totalPages) return;
		currentPage = page;
	}

	let nameInput: HTMLInputElement | null = $state(null);
	let lastNameInput: HTMLInputElement | null = $state(null);
	let phoneInput: HTMLInputElement | null = $state(null);
	let emailInput: HTMLInputElement | null = $state(null);
	let levelSelect: HTMLSelectElement | null = $state(null);
	let groupSelect: HTMLSelectElement | null = $state(null);
	let rollCodeInput: HTMLInputElement | null = $state(null);

	const canCreate = permissionsStore.has({ entity: 'students', action: 'create' });
	const canUpdate = permissionsStore.has({ entity: 'students', action: 'update' });
	const canDelete = permissionsStore.has({ entity: 'students', action: 'delete' });

	const { data } = $props<{ data: { levels: Level[] } }>();
	const groupOptions = ['A', 'B', 'C', 'D'];

	// Define table columns
	const studentColumns: TableColumn<RegisterStudent>[] = [
		{ key: 'roll_code', label: 'Código', class: 'text-accent font-medium' },
		{ key: 'name', label: 'Nombre', class: 'font-medium' },
		{ key: 'last_name', label: 'Apellido' },
		{
			key: 'phone',
			label: 'Teléfono',
			class: 'text-center',
			cell: (row: RegisterStudent) => row.phone || 'N/A'
		},
		{
			key: 'level',
			label: 'Nivel',
			class: 'text-center',
			cell: (row: RegisterStudent) =>
				`<span class="badge badge-primary badge-outline">${row.level}</span>`
		},
		{
			key: 'group_name',
			label: 'Grupo',
			class: 'text-center',
			cell: (row: RegisterStudent) => `<span class="badge badge-secondary">${row.group_name}</span>`
		},
		{
			key: 'created_at',
			label: 'Fecha de registro',
			class: 'text-sm text-gray-500',
			cell: (row: RegisterStudent) => formatDate(row.created_at)
		},
		{
			label: 'Acciones',
			headerClass: 'text-center',
			cell: (row: RegisterStudent) => {
				// Create SVG icons for the buttons
				const pencilIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil w-4 h-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;

				const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2 w-4 h-4"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;

				const bookIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book w-4 h-4"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>`;

				return `
					<div class="flex gap-2 justify-center">
						<button
							class="btn btn-sm btn-primary btn-outline ${!$canUpdate ? 'btn-disabled' : ''}"
							onclick="document.dispatchEvent(new CustomEvent('student-edit', {detail: '${row.student_code}'}))"
							aria-label="Editar estudiante"
							${!$canUpdate ? 'disabled' : ''}
						>
							${pencilIcon}
						</button>
						<button
							class="btn btn-sm btn-error btn-outline ${!$canDelete ? 'btn-disabled' : ''}"
							onclick="document.dispatchEvent(new CustomEvent('student-delete', {detail: '${row.student_code}'}))"
							aria-label="Eliminar estudiante"
							${!$canDelete ? 'disabled' : ''}
						>
							${trashIcon}
						</button>
						<button
							class="btn btn-sm btn-secondary btn-outline"
							onclick="document.dispatchEvent(new CustomEvent('student-registers', {detail: '${row.student_code}'}))"
							aria-label="Ver matrículas"
						>
							${bookIcon}
						</button>
					</div>
				`;
			}
		}
	];

	// Event handlers for custom events from table
	function setupTableEventListeners() {
		const handleStudentEdit = (event: CustomEvent) => {
			const studentCode = event.detail;
			const student = students.find((s) => s.student_code === studentCode);
			if (student) {
				openEditModal(student);
			}
		};

		const handleStudentDelete = (event: CustomEvent) => {
			const studentCode = event.detail;
			const student = students.find((s) => s.student_code === studentCode);
			if (student) {
				openDeleteConfirmModal(student);
			}
		};

		const handleViewRegisters = (event: CustomEvent) => {
			const studentCode = event.detail;
			const student = students.find((s) => s.student_code === studentCode);
			if (student) {
				openRegistersModal(student);
			}
		};

		document.addEventListener('student-edit', handleStudentEdit as EventListener);
		document.addEventListener('student-delete', handleStudentDelete as EventListener);
		document.addEventListener('student-registers', handleViewRegisters as EventListener);

		return () => {
			document.removeEventListener('student-edit', handleStudentEdit as EventListener);
			document.removeEventListener('student-delete', handleStudentDelete as EventListener);
			document.removeEventListener('student-registers', handleViewRegisters as EventListener);
		};
	}

	function openRegistersModal(student: RegisterStudent) {
		selectedStudentForRegisters = {
			code: student.student_code,
			name: `${student.name} ${student.last_name}`
		};
		registersModalOpen = true;
	}

	// Event listener cleanup
	let eventCleanup: (() => void) | null = null;

	onMount(() => {
		eventCleanup = setupTableEventListeners();

		// Setup modal close listener
		const handleModalClose = () => resetFormOnClose();
		modal?.addEventListener('close', handleModalClose);

		return () => {
			eventCleanup?.();
			modal?.removeEventListener('close', handleModalClose);
		};
	});

	async function fetchStudentsByFilter(group?: string) {
		if (group !== undefined) {
			selectedGroup = group;
		}
		if (!selectedLevelCode || !selectedGroup) {
			students = [];
			return;
		}
		const response = await fetch(`/api/student/${selectedLevelCode}/${selectedGroup}`);
		if (response.ok) {
			students = await response.json();
			// Reset to first page when loading new students
			currentPage = 1;
		}
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
	// Modal close listener is now handled in the main onMount above

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
	{#if $canCreate}
		<button class="btn btn-primary gap-2" onclick={openCreateModal}>
			<UserPlus class="w-4 h-4" />
			Registrar
		</button>
	{/if}
</PageTitle>

<div class="data-display flex flex-col sm:flex-row items-center gap-4">
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

	{#if selectedLevelCode && students.length > 0}
		<div class="relative w-full sm:w-auto flex-1 sm:flex-none sm:min-w-[300px] ml-auto">
			<div class="join w-full">
				<input
					type="text"
					placeholder="Buscar estudiante..."
					class="input input-bordered join-item w-full"
					bind:value={searchQuery}
				/>
				<button class="btn btn-primary join-item">
					<Search size={18} />
				</button>
			</div>
		</div>
	{/if}
</div>

{#if selectedLevelCode && students.length > 0}
	<div class="card card-gradient-neutral rounded-xl overflow-hidden">
		<div class="card-body">
			{#if filteredStudents.length > 0}
				<div class="overflow-x-auto animate-fade-in">
					<Table
						columns={studentColumns as unknown as {
							key?: string;
							label: string;
							headerClass?: string;
							class?: string;
							cell?: (row: unknown) => unknown;
						}[]}
						rows={paginatedStudents as unknown[]}
						striped={true}
						hover={true}
						bordered={true}
						emptyMessage="No hay estudiantes en este nivel y grupo."
					/>
					<div class="text-center mt-2">
						<span class="badge badge-primary badge-outline"
							>{paginatedStudents.length} estudiantes</span
						>
					</div>

					<!-- Paginación -->
					<Pagination {currentPage} {totalPages} onPageChange={goToPage} />
				</div>
			{:else if searchQuery}
				<div class="empty-state p-8 w-full max-w-md mx-auto">
					<div class="empty-state-icon">
						<Search size={48} />
					</div>
					<h3 class="empty-state-title">Sin resultados</h3>
					<p class="empty-state-message">
						No se encontraron estudiantes que coincidan con la búsqueda "{searchQuery}".
					</p>
				</div>
			{/if}
		</div>
	</div>
{:else if selectedLevelCode}
	<div class="empty-state py-8">
		<p class="empty-state-message">No hay estudiantes en este nivel y grupo.</p>
	</div>
{:else}
	<div class="empty-state py-8">
		<p class="empty-state-message">Selecciona un nivel y grupo para ver los estudiantes.</p>
	</div>
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
				<ul class="space-y-2 max-h-48 overflow-y-auto p-4 animate-fade-in">
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
				<div class="empty-state p-4">
					<p class="empty-state-message">Estudiante no encontrado</p>
				</div>
			{/if}
		{/if}

		{#if activeTab === 'new'}
			<form onsubmit={handleSubmit} autocomplete="off">
				<fieldset class="fieldset-container">
					<div class="form-group">
						<label class="form-group-label" for="name">Nombre</label>
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
					<div class="form-group">
						<label class="form-group-label" for="last_name">Apellidos</label>
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
					<div class="form-group">
						<label class="form-group-label" for="phone">Teléfono</label>
						<input
							id="phone"
							name="phone"
							type="text"
							class="input w-full validator"
							placeholder="Teléfono"
							bind:this={phoneInput}
						/>
					</div>
					<div class="form-group">
						<label class="form-group-label" for="email">Email</label>
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
					<div class="form-group">
						<label class="form-group-label" for="level">Nivel</label>
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
					<div class="form-group">
						<label class="form-group-label" for="group_name">Grupo</label>
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
					<div class="form-group">
						<label class="form-group-label" for="roll_code">Código de Matrícula</label>
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
						<small class="form-group-hint">Ingrese 4 dígitos (ej: 0001, 1234)</small>
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
	<div class="modal-box">
		<h3 class="text-lg font-bold mb-4">Confirmar eliminación</h3>
		<Message
			type="warning"
			description={`El estudiante "${selectForDelete?.name}" será eliminado`}
		/>
		<fieldset class="fieldset-container mt-4 grid-cols-1">
			<legend class="text-emphasis px-2">Opciones de eliminación</legend>
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
			<button class="btn btn-outline" onclick={() => confirmModal?.close()}>Cancelar</button>
			<button class="btn btn-error" onclick={handleDelete}>Eliminar</button>
		</div>
	</div>
</dialog>

<!-- Modal de matrículas -->
{#if selectedStudentForRegisters}
	<RegistersModal
		studentCode={selectedStudentForRegisters.code}
		studentName={selectedStudentForRegisters.name}
		open={registersModalOpen}
		onClose={() => (registersModalOpen = false)}
	/>
{/if}
