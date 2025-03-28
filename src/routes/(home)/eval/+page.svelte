<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { onMount, onDestroy } from 'svelte';
	import type { Level, Course } from '../../../app';
	import {
		ClipboardEdit,
		Trash2,
		Plus,
		AlertCircle,
		ChevronUp,
		ChevronDown,
		Calendar,
		BookOpen
	} from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { formatDate } from '$lib/utils/formatDate';

	let modal: HTMLDialogElement | null = $state(null);
	let confirmModal: HTMLDialogElement | null = $state(null);
	let message = $state('');
	let selectedCode = $state<string | null>(null);
	let selectForDelete = $state<{ code: string; name: string } | null>(null);
	let selectedLevelCode = $state('');
	let evals = $state<Record<string, unknown>[]>([]);
	let sections = $state<Record<string, unknown>[]>([]);
	let availableCourses = $state<Course[]>([]);

	let nameInput: HTMLInputElement | null = $state(null);
	let levelSelect: HTMLSelectElement | null = $state(null);
	let dateInput: HTMLInputElement | null = $state(null);

	const { data } = $props<{ data: { levels: Level[]; courses: Course[] } }>();

	// Función para obtener cursos disponibles según el nivel seleccionado
	function updateAvailableCourses() {
		if (!levelSelect?.value) {
			availableCourses = [];
			return;
		}

		const levelCode = levelSelect.value;
		// Filtramos los cursos por nivel
		availableCourses = data.courses.filter(
			(course: Course & { level_code?: string }) => course.level_code === levelCode
		);
	}

	async function fetchEvalsByLevel() {
		if (!selectedLevelCode) {
			evals = [];
			return;
		}
		const url = `/api/eval/${selectedLevelCode}`;

		const response = await fetch(url);
		if (response.ok) evals = await response.json();
	}

	async function fetchSections(evalCode: string) {
		const response = await fetch(`/api/eval/sections/${evalCode}`);
		if (response.ok) {
			sections = await response.json();
			updateAvailableCourses();
		}
	}

	function openCreateModal() {
		selectedCode = null;
		sections = [];
		modal?.showModal();

		queueMicrotask(() => {
			// Pre-seleccionar el nivel actual si está seleccionado
			if (selectedLevelCode && levelSelect) {
				levelSelect.value = selectedLevelCode;
				updateAvailableCourses();
			}

			// Enfocar el campo de nombre
			nameInput?.focus();
		});
	}

	function openEditModal(item: Record<string, unknown>) {
		selectedCode = item.code as string;
		modal?.showModal();

		queueMicrotask(() => {
			if (nameInput) nameInput.value = (item.name as string) || '';
			if (levelSelect) {
				levelSelect.value = (item.level_code as string) || '';
				updateAvailableCourses();
			}

			if (dateInput && item.eval_date)
				dateInput.value = typeof item.eval_date === 'string' ? item.eval_date.substring(0, 10) : '';

			// Cargar secciones
			fetchSections(item.code as string);
		});
	}

	function openDeleteConfirmModal(evalItem: Record<string, unknown>) {
		selectForDelete = {
			code: evalItem.code as string,
			name: evalItem.name as string
		};
		confirmModal?.showModal();
	}

	function addSection() {
		if (!levelSelect?.value) {
			showToast('Selecciona un nivel primero', 'warning');
			return;
		}

		const usedCourseCodes = sections.map((s) => s.course_code);
		const availableCoursesForAdd = availableCourses.filter(
			(c) => !usedCourseCodes.includes(c.code)
		);

		if (availableCoursesForAdd.length === 0) {
			showToast('No hay más cursos disponibles para agregar', 'warning');
			return;
		}

		const newOrder =
			sections.length > 0 ? Math.max(...sections.map((s) => Number(s.order_in_eval))) + 1 : 1;

		sections = [
			...sections,
			{
				course_code: availableCoursesForAdd[0].code,
				course_name: availableCoursesForAdd[0].name,
				order_in_eval: newOrder,
				question_count: 10
			}
		];
	}

	function removeSection(index: number) {
		sections = sections.filter((_, i) => i !== index);
	}

	function moveSection(index: number, direction: 'up' | 'down') {
		if (sections.length <= 1) return;

		const newSections = [...sections];
		const targetIndex = direction === 'up' ? index - 1 : index + 1;

		if (targetIndex < 0 || targetIndex >= newSections.length) return;

		// Swap orders
		const temp = newSections[index].order_in_eval;
		newSections[index].order_in_eval = newSections[targetIndex].order_in_eval;
		newSections[targetIndex].order_in_eval = temp;

		// Swap positions
		[newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];

		sections = newSections;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (sections.length === 0) {
			message = 'Debe agregar al menos una sección al examen';
			return;
		}

		const formData = new FormData();
		formData.append('name', nameInput?.value || '');
		formData.append('level_code', levelSelect?.value || '');
		formData.append('group_name', 'A'); // Valor por defecto
		formData.append('eval_date', dateInput?.value || '');
		formData.append('sections', JSON.stringify(sections));

		if (selectedCode) {
			formData.append('code', selectedCode.toString());
		}

		const response = await fetch('?/create', { method: 'POST', body: formData });
		const res = await response.json();

		if (res.type === 'success') {
			showToast(
				`${selectedCode ? 'Examen actualizado' : 'Examen registrado'} exitosamente`,
				'success'
			);
			await fetchEvalsByLevel();
			modal?.close();
		} else {
			message =
				responseMessage(res) || `Error al ${selectedCode ? 'actualizar' : 'registrar'} examen`;
		}
	}

	function resetFormOnClose() {
		selectedCode = null;
		message = '';
		sections = [];
		if (nameInput) nameInput.value = '';
		if (levelSelect) levelSelect.value = '';
		if (dateInput) dateInput.value = '';
		availableCourses = [];
	}
	onMount(() => {
		if (modal) modal.addEventListener('close', resetFormOnClose);
	});
	onDestroy(() => {
		if (modal) modal.removeEventListener('close', resetFormOnClose);
	});

	async function handleDelete() {
		if (!selectForDelete) return;
		const formData = new FormData();
		formData.append('code', selectForDelete.code);
		const response = await fetch('?/delete', { method: 'POST', body: formData });
		const res = await response.json();
		confirmModal?.close();
		selectForDelete = null;
		if (res.type === 'success') {
			showToast('Examen eliminado exitosamente', 'success');
			await fetchEvalsByLevel();
		} else {
			showToast(responseMessage(res) || 'Error eliminando examen', 'danger');
		}
	}
</script>

<PageTitle title="Exámenes" description="Gestión de evaluaciones por nivel y grupo">
	<button class="btn btn-primary gap-2" onclick={openCreateModal}>
		<Plus class="w-4 h-4" />
		Nuevo Examen
	</button>
</PageTitle>

<div class="p-5 bg-base-200 rounded-xl mb-6 shadow-sm">
	<div class="flex items-center gap-4">
		<div class="w-full">
			<label class="label">
				<span class="label-text flex items-center gap-1">
					<BookOpen class="w-4 h-4" /> Nivel
				</span>
			</label>
			<select
				class="select select-bordered w-full"
				bind:value={selectedLevelCode}
				onchange={() => fetchEvalsByLevel()}
			>
				<option value="" disabled selected>Selecciona un nivel</option>
				{#each data.levels as level (level.code)}
					<option value={level.code}>{level.name}</option>
				{/each}
			</select>
		</div>
	</div>
</div>

{#if selectedLevelCode && evals.length > 0}
	<div
		class="card bg-gradient-to-br from-base-200 to-base-100 shadow-md hover:shadow-lg transition-all duration-300 border border-base-300/30 rounded-xl overflow-hidden"
	>
		<div class="card-body p-0 overflow-x-auto">
			<table class="table table-zebra w-full">
				<thead>
					<tr>
						<th>Nombre</th>
						<th>Nivel</th>
						<th>Fecha</th>
						<th>Secciones</th>
						<th class="text-center">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each evals as evalItem (evalItem.code)}
						<tr class="hover:bg-base-300 transition-colors border-b border-base-300">
							<td class="py-3 px-4 font-medium">{evalItem.name}</td>
							<td class="py-3 px-4">
								<span class="badge badge-primary badge-outline flex items-center gap-1">
									<BookOpen class="w-3 h-3" />
									{((evalItem.levels as Record<string, unknown>)?.name as string) || 'N/A'}
								</span>
							</td>
							<td class="py-3 px-4 text-sm text-gray-500 flex items-center justify-center gap-1">
								<Calendar class="w-3 h-3 opacity-70" />
								{formatDate(evalItem.eval_date as string)}
							</td>
							<td class="py-3 px-4 text-center">
								<span class="badge badge-accent"
									>{(evalItem.eval_sections as unknown[])?.length || 0}</span
								>
							</td>
							<td class="py-3 px-4">
								<div class="flex gap-2 justify-center">
									<button
										class="btn btn-sm btn-primary btn-outline"
										onclick={() => openEditModal(evalItem)}
										aria-label="Editar examen"
									>
										<ClipboardEdit class="w-4 h-4" />
									</button>
									<button
										class="btn btn-sm btn-error btn-outline"
										onclick={() => openDeleteConfirmModal(evalItem)}
										aria-label="Eliminar examen"
									>
										<Trash2 class="w-4 h-4" />
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
	<p class="text-center py-4 opacity-50">No hay exámenes en este nivel.</p>
{:else}
	<p class="text-center py-4 opacity-50">Selecciona un nivel para ver los exámenes.</p>
{/if}

<!-- Modal para crear/editar examen -->
<dialog bind:this={modal} class="modal modal-bottom sm:modal-middle">
	<div class="modal-box max-w-3xl">
		<h3 class="font-bold text-xl flex items-center gap-2">
			{#if selectedCode}
				<ClipboardEdit class="w-5 h-5 text-primary" />
				Editar Examen
			{:else}
				<Plus class="w-5 h-5 text-primary" />
				Registrar Nuevo Examen
			{/if}
		</h3>
		<form onsubmit={handleSubmit} class="mt-6">
			{#if message}
				<div class="alert alert-error mb-4">
					<AlertCircle class="w-5 h-5" />
					<span>{message}</span>
				</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
				<div class="form-control">
					<label class="label" for="name">
						<span class="label-text font-medium">Nombre del Examen</span>
					</label>
					<input
						id="name"
						bind:this={nameInput}
						type="text"
						class="input input-bordered w-full"
						placeholder="Ej. Examen Parcial 1"
						required
					/>
				</div>

				<div class="form-control">
					<label class="label" for="level">
						<span class="label-text flex items-center gap-1">
							<BookOpen class="w-4 h-4" /> Nivel
						</span>
					</label>
					<select
						id="level"
						bind:this={levelSelect}
						class="select select-bordered w-full"
						onchange={() => updateAvailableCourses()}
						required
					>
						<option value="" disabled selected>Selecciona un nivel</option>
						{#each data.levels as level (level.code)}
							<option value={level.code}>{level.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-control">
					<label class="label" for="date">
						<span class="label-text flex items-center gap-1">
							<Calendar class="w-4 h-4" /> Fecha del Examen
						</span>
					</label>
					<input
						id="date"
						bind:this={dateInput}
						type="date"
						class="input input-bordered w-full"
						required
					/>
				</div>
			</div>

			<!-- Secciones del examen -->
			<div class="mt-8">
				<div class="flex justify-between items-center mb-4 border-b pb-2">
					<h4 class="font-semibold text-md flex items-center gap-2">
						<BookOpen class="w-5 h-5 text-primary" />
						Secciones del Examen
					</h4>
					<button type="button" class="btn btn-sm btn-primary gap-1" onclick={addSection}>
						<Plus class="w-4 h-4" />
						Agregar Sección
					</button>
				</div>

				{#if sections.length === 0}
					<div class="text-center py-6 bg-base-200 rounded-lg border border-base-300">
						<p class="text-sm opacity-70 flex flex-col items-center gap-2">
							<AlertCircle class="w-5 h-5" />
							No hay secciones. Agrega al menos una sección al examen.
						</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-zebra w-full">
							<thead>
								<tr>
									<th class="text-center">Orden</th>
									<th>Curso</th>
									<th class="text-center">Preguntas</th>
									<th class="text-center">Acciones</th>
								</tr>
							</thead>
							<tbody>
								{#each sections as section, i (i)}
									<tr>
										<td class="text-center font-medium">{section.order_in_eval}</td>
										<td>
											<select
												class="select select-bordered select-sm w-full max-w-xs"
												bind:value={section.course_code}
												onchange={(e) => {
													const selectedCourse = availableCourses.find(
														(c: Course) => c.code === e.currentTarget.value
													);
													if (selectedCourse) {
														section.course_name = selectedCourse.name;
														sections = [...sections];
													}
												}}
											>
												{#each availableCourses.filter((c: Course) => c.code === section.course_code || !sections.some((s) => s !== section && s.course_code === c.code)) as course (course.code)}
													<option value={course.code}>{course.name}</option>
												{/each}
											</select>
										</td>
										<td class="text-center">
											<input
												type="number"
												class="input input-bordered input-sm w-20 text-center mx-auto"
												min="1"
												max="50"
												bind:value={section.question_count}
											/>
										</td>
										<td class="text-center">
											<div class="flex gap-1 justify-center">
												<button
													type="button"
													class="btn btn-xs btn-outline"
													disabled={i === 0}
													onclick={() => moveSection(i, 'up')}
													aria-label="Mover arriba"
												>
													<ChevronUp class="w-3 h-3" />
												</button>
												<button
													type="button"
													class="btn btn-xs btn-outline"
													disabled={i === sections.length - 1}
													onclick={() => moveSection(i, 'down')}
													aria-label="Mover abajo"
												>
													<ChevronDown class="w-3 h-3" />
												</button>
												<button
													type="button"
													class="btn btn-xs btn-error btn-outline"
													onclick={() => removeSection(i)}
													aria-label="Eliminar sección"
												>
													<Trash2 class="w-3 h-3" />
												</button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<div class="modal-action mt-8">
				<button type="button" class="btn btn-ghost" onclick={() => modal?.close()}>Cancelar</button>
				<button type="submit" class="btn btn-primary gap-2">
					{#if selectedCode}
						<ClipboardEdit class="w-4 h-4" />
						Actualizar
					{:else}
						<Plus class="w-4 h-4" />
						Registrar
					{/if}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<!-- Modal de confirmación para eliminar -->
<dialog bind:this={confirmModal} class="modal modal-bottom sm:modal-middle">
	<div class="modal-box">
		<h3 class="font-bold text-lg">Confirmar eliminación</h3>
		<p class="py-4">
			¿Estás seguro que deseas eliminar el examen <span class="font-semibold">
				{selectForDelete?.name || ''}
			</span>?
			<br />
			<span class="text-sm text-error">Esta acción no se puede deshacer.</span>
		</p>
		<div class="modal-action">
			<form method="dialog">
				<button class="btn btn-ghost">Cancelar</button>
			</form>
			<button class="btn btn-error" onclick={handleDelete}>Eliminar</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
