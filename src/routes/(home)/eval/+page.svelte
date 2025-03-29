<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import type { Level, Course, FormSection, EvalWithSections } from '../../../app';
	import {
		ClipboardEdit,
		Trash2,
		Plus,
		AlertCircle,
		ChevronUp,
		ChevronDown,
		Calendar,
		BookOpen,
		ClipboardList
	} from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { formatDate } from '$lib/utils/formatDate';

	let modal: HTMLDialogElement | null = null;
	let confirmModal: HTMLDialogElement | null = null;

	let formState = $state({
		message: '',
		selectedCode: null as string | null,
		selectForDelete: null as { code: string; name: string } | null,
		selectedLevelCode: '',
		evals: [] as EvalWithSections[],
		sections: [] as FormSection[],
		selectedCourseCode: '',
		name: '',
		level_code: '',
		eval_date: '',
		group_name: ''
	});

	const { data } = $props<{ data: { levels: Level[]; courses: Course[] } }>();

	let availableCoursesForAdd = $derived(
		data.courses.filter(
			(course: Course) => !formState.sections.some((section) => section.course_code === course.code)
		)
	);

	let totalQuestions = $derived(
		formState.sections.reduce((sum, section) => sum + (section.question_count || 0), 0)
	);

	async function fetchEvalsByLevel() {
		if (!formState.selectedLevelCode) {
			formState.evals = [];
			return;
		}
		try {
			const response = await fetch(`/api/eval/${formState.selectedLevelCode}`);
			if (response.ok) formState.evals = await response.json();
			else throw new Error('Error al cargar exámenes');
		} catch {
			showToast('No se pudieron cargar los exámenes', 'danger');
		}
	}

	function openCreateModal() {
		formState.selectedCode = null;
		formState.sections = [];
		formState.name = '';
		formState.level_code = '';
		formState.eval_date = '';
		formState.group_name = '';
		modal?.showModal();
	}

	function openEditModal(item: EvalWithSections) {
		formState.selectedCode = item.code;
		formState.name = item.name || '';
		formState.level_code = item.level_code || '';
		formState.eval_date = item.eval_date ? item.eval_date.substring(0, 10) : '';
		formState.group_name = item.group_name || '';
		formState.sections = item.eval_sections.map((s) => ({
			course_code: s.course_code,
			course_name: s.course_name,
			order_in_eval: s.order_in_eval,
			question_count: s.question_count
		}));
		modal?.showModal();
	}

	function openDeleteConfirmModal(evalItem: EvalWithSections) {
		formState.selectForDelete = { code: evalItem.code, name: evalItem.name };
		confirmModal?.showModal();
	}

	function findCourseByCode(code: string): Course | undefined {
		return data.courses.find((c: Course) => c.code === code);
	}

	function addSection() {
		if (!formState.selectedCourseCode) {
			showToast('Selecciona un curso primero', 'warning');
			return;
		}
		const course = findCourseByCode(formState.selectedCourseCode);
		if (!course) return;
		const newOrder =
			formState.sections.length > 0
				? Math.max(...formState.sections.map((s) => s.order_in_eval)) + 1
				: 1;
		const newSection = {
			course_code: course.code,
			course_name: course.name,
			order_in_eval: newOrder,
			question_count: 10
		};
		if (totalQuestions + newSection.question_count > 80) {
			showToast('No se puede agregar la sección: el total de preguntas excede 80', 'warning');
			return;
		}
		formState.sections = [...formState.sections, newSection];
		formState.selectedCourseCode = '';
	}

	function removeSection(index: number) {
		formState.sections = formState.sections.filter((_, i) => i !== index);
	}

	function moveSection(index: number, direction: 'up' | 'down') {
		if (formState.sections.length <= 1) return;
		const newSections = [...formState.sections];
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= newSections.length) return;
		[newSections[index].order_in_eval, newSections[targetIndex].order_in_eval] = [
			newSections[targetIndex].order_in_eval,
			newSections[index].order_in_eval
		];
		[newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
		formState.sections = newSections;
	}

	function updateQuestionCount(index: number, value: number) {
		const newTotal = totalQuestions - formState.sections[index].question_count + value;
		if (newTotal > 80) {
			showToast('No se puede actualizar: el total de preguntas excede 80', 'warning');
			return;
		}
		formState.sections[index].question_count = value;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (formState.sections.length === 0) {
			formState.message = 'Debe agregar al menos una sección al examen';
			return;
		}
		if (totalQuestions > 80) {
			formState.message = 'El total de preguntas no puede exceder 80';
			return;
		}
		const formData = new FormData();
		formData.append('name', formState.name);
		formData.append('level_code', formState.level_code);
		formData.append('group_name', formState.group_name);
		formData.append('eval_date', formState.eval_date);
		formData.append('sections', JSON.stringify(formState.sections));
		if (formState.selectedCode) formData.append('code', formState.selectedCode);

		const response = await fetch('?/create', { method: 'POST', body: formData });
		const res = await response.json();

		if (res.type === 'success') {
			formState.message = '';
			showToast(
				`${formState.selectedCode ? 'Examen actualizado' : 'Examen registrado'} exitosamente`,
				'success'
			);
			await fetchEvalsByLevel();
			modal?.close();
		} else {
			formState.message =
				responseMessage(res) ||
				`Error al ${formState.selectedCode ? 'actualizar' : 'registrar'} examen`;
		}
	}

	async function handleDelete() {
		if (!formState.selectForDelete) return;
		const formData = new FormData();
		formData.append('code', formState.selectForDelete.code);
		const response = await fetch('?/delete', { method: 'POST', body: formData });
		const res = await response.json();
		confirmModal?.close();
		formState.selectForDelete = null;
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

<div
	class="p-5 bg-gradient-to-r from-primary/10 to-base-200 rounded-xl mb-6 shadow-sm flex items-center justify-between flex-wrap"
>
	<label class="label font-semibold text-primary">
		<BookOpen class="w-5 h-5 mr-2" /> Selecciona un Nivel
	</label>
	<select
		class="select select-bordered w-full max-w-xs focus:ring-2 focus:ring-primary"
		bind:value={formState.selectedLevelCode}
		onchange={() => fetchEvalsByLevel()}
	>
		<option value="" disabled selected>Elige un nivel</option>
		{#each data.levels as level (level.code)}
			<option value={level.code}>{level.name}</option>
		{/each}
	</select>
</div>

{#if formState.selectedLevelCode && formState.evals.length > 0}
	<div
		class="card bg-gradient-to-br from-base-200 to-base-100 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl overflow-hidden"
	>
		<div class="card-body p-0 overflow-x-auto">
			<table class="table table-zebra w-full">
				<thead class="bg-base-200 sticky top-0 z-10">
					<tr>
						<th class="text-left">Nombre</th>
						<th class="text-center">Nivel</th>
						<th class="text-center">Grupo</th>
						<th class="text-center">Fecha</th>
						<th class="text-center">Secciones</th>
						<th class="text-center">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each formState.evals as evalItem (evalItem.code)}
						<tr class="hover:bg-base-300 transition-colors border-b border-base-200">
							<td class="py-4 px-6 font-medium text-accent">{evalItem.name}</td>
							<td class="py-4 px-6 text-center">
								<span
									class="badge badge-primary badge-outline flex items-center gap-1 justify-center mx-auto"
								>
									<BookOpen class="w-3 h-3" />
									{evalItem.levels?.name || 'N/A'}
								</span>
							</td>
							<td class="py-4 px-6 text-center">
								<span class="badge badge-secondary">{evalItem.group_name || 'N/A'}</span>
							</td>
							<td class="py-4 px-6 text-center">
								<div class="flex items-center justify-center gap-1 text-sm text-gray-500">
									<Calendar class="w-3 h-3 opacity-70" />
									{formatDate(evalItem.eval_date)}
								</div>
							</td>
							<td class="py-4 px-6 text-center">
								<span class="badge badge-accent">{evalItem.eval_sections?.length || 0}</span>
							</td>
							<td class="py-4 px-6">
								<div class="flex gap-2 justify-center">
									<button
										class="btn btn-sm btn-primary btn-outline"
										title="Editar examen"
										onclick={() => openEditModal(evalItem)}
										aria-label="Editar examen"
									>
										<ClipboardEdit class="w-4 h-4" />
									</button>
									<button
										class="btn btn-sm btn-error btn-outline"
										title="Eliminar examen"
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
{:else if formState.selectedLevelCode}
	<p class="text-center py-4 opacity-50">No hay exámenes en este nivel.</p>
{:else}
	<p class="text-center py-4 opacity-50">Selecciona un nivel para ver los exámenes.</p>
{/if}

<dialog bind:this={modal} class="modal" aria-label="Formulario de examen">
	<div class="modal-box bg-base-100 rounded-lg p-6">
		<h3 class="font-bold text-xl flex items-center gap-2 mb-6">
			{#if formState.selectedCode}
				<ClipboardEdit class="w-5 h-5 text-primary" /> Editar Examen
			{:else}
				<Plus class="w-5 h-5 text-primary" /> Nuevo Examen
			{/if}
		</h3>
		<form onsubmit={handleSubmit} class="space-y-6" autocomplete="off">
			{#if formState.message}
				<div class="alert alert-error flex items-center gap-2">
					<AlertCircle class="w-5 h-5" />
					{formState.message}
				</div>
			{/if}
			<fieldset
				class="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 border border-base-300 rounded-lg bg-base-200"
			>
				<legend class="px-2 font-semibold text-primary">Información del Examen</legend>
				<div>
					<label class="label font-medium" for="name">Nombre</label>
					<input
						id="name"
						name="name"
						type="text"
						class="input w-full validator focus:ring-2 focus:ring-primary"
						placeholder="Ej: Examen Final"
						required
						bind:value={formState.name}
					/>
				</div>
				<div>
					<label class="label font-medium" for="date">Fecha</label>
					<input
						id="date"
						name="date"
						type="date"
						class="input w-full validator focus:ring-2 focus:ring-primary"
						required
						bind:value={formState.eval_date}
					/>
				</div>
				<div>
					<label class="label font-medium" for="level">Nivel</label>
					<select
						id="level"
						name="level"
						class="select w-full validator focus:ring-2 focus:ring-primary"
						required
						bind:value={formState.level_code}
					>
						<option value="" disabled>Seleccionar nivel</option>
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
						class="select w-full validator focus:ring-2 focus:ring-primary"
						required
						bind:value={formState.group_name}
					>
						<option value="" disabled>Seleccionar grupo</option>
						<option value="A">A</option>
						<option value="B">B</option>
						<option value="C">C</option>
						<option value="D">D</option>
					</select>
				</div>
			</fieldset>
			<div>
				<h4 class="font-semibold flex items-center gap-2 mb-3">
					<ClipboardList class="w-4 h-4 text-primary" /> Secciones
				</h4>
				{#if formState.sections.length === 0}
					<p class="text-center py-4 text-gray-500">Agrega una sección abajo</p>
				{:else}
					<div class="max-h-48 overflow-auto">
						<table class="table w-full">
							<thead class="bg-base-200 sticky top-0 z-10">
								<tr>
									<th>#</th>
									<th>Curso</th>
									<th>Preguntas</th>
									<th>Orden</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{#each formState.sections as section, i (section.course_code)}
									<tr class="hover:bg-base-100">
										<td>{i + 1}</td>
										<td>{section.course_name}</td>
										<td>
											<input
												type="number"
												class="input input-sm w-16"
												min="1"
												bind:value={section.question_count}
												oninput={(e: Event) =>
													updateQuestionCount(i, +(e.target as HTMLInputElement).value)}
											/>
										</td>
										<td>
											<div class="join">
												<button
													type="button"
													class="btn btn-xs btn-primary join-item"
													onclick={() => moveSection(i, 'up')}
													disabled={i === 0}
													tabindex="-1"
												>
													<ChevronUp class="w-3 h-3" />
												</button>
												<button
													type="button"
													class="btn btn-xs btn-primary join-item"
													onclick={() => moveSection(i, 'down')}
													disabled={i === formState.sections.length - 1}
													tabindex="-1"
												>
													<ChevronDown class="w-3 h-3" />
												</button>
											</div>
										</td>
										<td>
											<button
												type="button"
												class="btn btn-xs btn-error"
												onclick={() => removeSection(i)}
												tabindex="-1"
											>
												<Trash2 class="w-3 h-3" />
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<p class="mt-2 text-sm text-gray-500">Total de preguntas: {totalQuestions} / 80</p>
				{/if}
				<select
					bind:value={formState.selectedCourseCode}
					class="select select-bordered w-full mt-4"
					onchange={addSection}
					disabled={availableCoursesForAdd.length === 0 || totalQuestions >= 80}
				>
					<option value="" disabled selected>
						{availableCoursesForAdd.length === 0 ? 'No hay más cursos' : 'Agregar curso'}
					</option>
					{#each availableCoursesForAdd as course (course.code)}
						<option value={course.code}>{course.name}</option>
					{/each}
				</select>
			</div>
			<div class="flex justify-end gap-2">
				<button type="button" class="btn btn-ghost" onclick={() => modal?.close()}>
					Cancelar
				</button>
				<button type="submit" class="btn btn-primary gap-2 hover:scale-105 transition-transform">
					{#if formState.selectedCode}
						<ClipboardEdit class="w-4 h-4" /> Actualizar
					{:else}
						<BookOpen class="w-4 h-4" /> Crear
					{/if}
				</button>
			</div>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>

<dialog bind:this={confirmModal} class="modal" aria-label="Confirmar eliminación">
	<div class="modal-box">
		<h3 class="font-bold text-lg">Confirmar eliminación</h3>
		<p class="py-4">
			¿Estás seguro que deseas eliminar el examen
			<span class="font-semibold">{formState.selectForDelete?.name || ''}</span>?
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
