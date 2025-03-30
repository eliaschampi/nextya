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
		ClipboardList,
		Key
	} from 'lucide-svelte';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { formatDate } from '$lib/utils/formatDate';

	let modal: HTMLDialogElement | null = null;
	let confirmModal: HTMLDialogElement | null = null;

	const DEFAULT_QUESTIONS_PER_SECTION = 10;
	const MAX_TOTAL_QUESTIONS = 80;

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
		const response = await fetch(`/api/eval/${formState.selectedLevelCode}`);
		if (response.ok) formState.evals = await response.json();
	}

	function openCreateModal() {
		formState.selectedCode = null;
		formState.sections = [];
		formState.name = '';
		formState.level_code = '';
		formState.eval_date = '';
		formState.group_name = '';
		formState.message = '';
		formState.selectedCourseCode = '';
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
			question_count: Number(s.question_count) || DEFAULT_QUESTIONS_PER_SECTION
		}));
		formState.message = '';
		formState.selectedCourseCode = '';
		modal?.showModal();
	}

	function openDeleteConfirmModal(evalItem: EvalWithSections) {
		formState.selectForDelete = { code: evalItem.code, name: evalItem.name };
		confirmModal?.showModal();
	}

	function findCourseByCode(code: string): Course | undefined {
		return data.courses.find((c: Course) => c.code === code);
	}

	function addSectionTrigger() {
		if (!formState.selectedCourseCode) return;
		if (totalQuestions + DEFAULT_QUESTIONS_PER_SECTION > MAX_TOTAL_QUESTIONS) {
			formState.selectedCourseCode = '';
			return;
		}

		const course = findCourseByCode(formState.selectedCourseCode);
		if (!course) {
			formState.selectedCourseCode = '';
			return;
		}

		const newOrder =
			formState.sections.length > 0
				? Math.max(...formState.sections.map((s) => s.order_in_eval)) + 1
				: 1;
		const newSection: FormSection = {
			course_code: course.code,
			course_name: course.name,
			order_in_eval: newOrder,
			question_count: DEFAULT_QUESTIONS_PER_SECTION
		};

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

	async function handleSubmit(event: Event) {
		event.preventDefault();
		formState.message = '';

		if (formState.sections.length === 0) {
			formState.message = 'Debe agregar al menos una sección al examen';
			return;
		}
		if (totalQuestions > MAX_TOTAL_QUESTIONS) {
			formState.message = `El total de preguntas (${totalQuestions}) no puede exceder ${MAX_TOTAL_QUESTIONS}`;
			return;
		}
		if (formState.sections.some((s) => !s.question_count || s.question_count <= 0)) {
			formState.message = 'Todas las secciones deben tener al menos 1 pregunta.';
			return;
		}

		const formData = new FormData();
		formData.append('name', formState.name);
		formData.append('level_code', formState.level_code);
		formData.append('group_name', formState.group_name);
		formData.append('eval_date', formState.eval_date);
		const sectionsToSend = formState.sections.map((s) => ({
			...s,
			question_count: Number(s.question_count)
		}));
		formData.append('sections', JSON.stringify(sectionsToSend));
		if (formState.selectedCode) formData.append('code', formState.selectedCode);

		const response = await fetch('?/create', { method: 'POST', body: formData });
		const res = await response.json();

		if (res.type === 'success') {
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
		const deletedName = formState.selectForDelete.name;
		formState.selectForDelete = null;
		if (res.type === 'success') {
			showToast(`Examen "${deletedName}" eliminado exitosamente`, 'success');
			await fetchEvalsByLevel();
		} else {
			showToast(responseMessage(res) || `Error eliminando "${deletedName}"`, 'danger');
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
	class="p-5 bg-gradient-to-r from-primary/10 to-base-200 rounded-xl mb-6 shadow-sm flex items-center justify-between flex-wrap gap-4"
>
	<label class="label font-semibold text-primary flex items-center">
		<BookOpen class="w-5 h-5 mr-2" /> Selecciona un Nivel
	</label>
	<select
		class="select select-bordered w-full sm:w-auto max-w-xs focus:ring-2 focus:ring-primary"
		bind:value={formState.selectedLevelCode}
		onchange={fetchEvalsByLevel}
		aria-label="Seleccionar Nivel"
	>
		<option value="" disabled>Elige un nivel</option>
		{#each data.levels as level (level.code)}
			<option value={level.code}>{level.name}</option>
		{/each}
	</select>
</div>

{#if formState.selectedLevelCode && formState.evals.length > 0}
	<div
		class="card bg-gradient-to-br from-base-200 to-base-100 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl overflow-hidden mb-6"
	>
		<div class="card-body p-0 overflow-x-auto">
			<table class="table table-zebra w-full">
				<thead class="bg-base-200 sticky top-0 z-10">
					<tr>
						<th class="text-left px-6 py-3">Nombre</th>
						<th class="text-center px-6 py-3">Nivel</th>
						<th class="text-center px-6 py-3">Grupo</th>
						<th class="text-center px-6 py-3">Fecha</th>
						<th class="text-center px-6 py-3">Secciones</th>
						<th class="text-center px-6 py-3">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each formState.evals as evalItem (evalItem.code)}
						<tr
							class="hover:bg-base-300 transition-colors border-b border-base-200 last:border-b-0"
						>
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
									<a
										href={`/eval/keys/${evalItem.code}`}
										class="btn btn-xs sm:btn-sm btn-accent btn-outline"
										title="Gestionar claves"
										aria-label="Gestionar claves para {evalItem.name}"
									>
										<Key class="w-4 h-4" />
									</a>
									<button
										class="btn btn-xs sm:btn-sm btn-primary btn-outline"
										title="Editar examen"
										onclick={() => openEditModal(evalItem)}
										aria-label="Editar examen {evalItem.name}"
									>
										<ClipboardEdit class="w-4 h-4" />
									</button>
									<button
										class="btn btn-xs sm:btn-sm btn-error btn-outline"
										title="Eliminar examen"
										onclick={() => openDeleteConfirmModal(evalItem)}
										aria-label="Eliminar examen {evalItem.name}"
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
	<div class="text-center py-10 opacity-60 bg-base-200 rounded-lg shadow-sm">
		<ClipboardList class="w-12 h-12 mx-auto mb-3 text-primary" />
		<p>No se encontraron exámenes para este nivel.</p>
		<p class="text-sm mt-1">Puedes crear uno usando el botón "Nuevo Examen".</p>
	</div>
{:else}
	<div class="text-center py-10 opacity-60 bg-base-200 rounded-lg shadow-sm">
		<BookOpen class="w-12 h-12 mx-auto mb-3 text-primary" />
		<p>Selecciona un nivel arriba para ver o gestionar sus exámenes.</p>
	</div>
{/if}

<dialog bind:this={modal} class="modal" aria-labelledby="modal-title">
	<div class="modal-box">
		<h3 id="modal-title" class="font-bold text-xl flex items-center gap-2 mb-6">
			{#if formState.selectedCode}
				<ClipboardEdit class="w-5 h-5 text-primary" /> Editar Examen
			{:else}
				<Plus class="w-5 h-5 text-primary" /> Nuevo Examen
			{/if}
		</h3>
		<form onsubmit={handleSubmit} class="space-y-6" autocomplete="off" novalidate>
			{#if formState.message}
				<div role="alert" class="alert alert-error flex items-center gap-2 text-sm p-3">
					<AlertCircle class="w-5 h-5 flex-shrink-0" />
					<span>{formState.message}</span>
				</div>
			{/if}
			<fieldset
				class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 p-4 border border-base-300 rounded-lg bg-base-200/50"
			>
				<legend class="px-2 font-semibold text-primary text-sm">Información del Examen</legend>
				<div>
					<label class="label font-medium text-sm pb-1" for="name">Nombre</label>
					<input
						id="name"
						name="name"
						type="text"
						class="input input-bordered w-full validator focus:ring-2 focus:ring-primary focus:border-primary"
						placeholder="Ej: Examen Final 1"
						required
						bind:value={formState.name}
					/>
				</div>
				<div>
					<label class="label font-medium text-sm pb-1" for="date">Fecha</label>
					<input
						id="date"
						name="date"
						type="date"
						class="input input-bordered w-full validator focus:ring-2 focus:ring-primary focus:border-primary"
						required
						bind:value={formState.eval_date}
					/>
				</div>
				<div>
					<label class="label font-medium text-sm pb-1" for="level">Nivel</label>
					<select
						id="level"
						name="level"
						class="select select-bordered w-full validator focus:ring-2 focus:ring-primary focus:border-primary"
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
					<label class="label font-medium text-sm pb-1" for="group_name">Grupo</label>
					<select
						id="group_name"
						name="group_name"
						class="select select-bordered w-full validator focus:ring-2 focus:ring-primary focus:border-primary"
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

			<!-- Sections Management -->
			<div class="p-4 border border-base-300 rounded-lg bg-base-200/50">
				<h4 class="font-semibold flex items-center gap-2 mb-3 text-sm text-primary">
					<ClipboardList class="w-4 h-4" /> Secciones del Examen
				</h4>
				{#if formState.sections.length === 0}
					<p class="text-center py-4 text-gray-500 text-sm">Aún no hay secciones.</p>
				{:else}
					<div class="max-h-60 overflow-y-auto mb-3 -mx-4 px-4">
						<table class="table table-xs sm:table-sm w-full">
							<thead class="bg-base-200 sticky top-0 z-10">
								<tr>
									<th class="w-8">#</th>
									<th>Curso</th>
									<th class="w-24">Preguntas</th>
									<th class="w-20">Orden</th>
									<th class="w-12"></th>
								</tr>
							</thead>
							<tbody>
								{#each formState.sections as section, i (section.course_code)}
									{@const maxQuestionsAllowedForThis =
										MAX_TOTAL_QUESTIONS - totalQuestions + section.question_count}
									<tr class="hover:bg-base-100/50">
										<td class="text-center">{i + 1}</td>
										<td>{section.course_name}</td>
										<td>
											<input
												type="number"
												class="input input-bordered input-sm w-20 text-center"
												min="1"
												max={maxQuestionsAllowedForThis}
												required
												aria-label={`Preguntas para ${section.course_name}`}
												bind:value={section.question_count}
												oninput={(e) => {
													const input = e.target as HTMLInputElement;
													let val = parseInt(input.value, 10);
													if (isNaN(val) || val < 1) val = 1;
													if (val > maxQuestionsAllowedForThis) {
														val = maxQuestionsAllowedForThis;
														input.value = String(val);
													}
													if (section.question_count !== val) {
														section.question_count = val;
													}
												}}
											/>
										</td>
										<td>
											<div class="join">
												<button
													type="button"
													class="btn btn-xs btn-primary join-item"
													title="Mover arriba"
													onclick={() => moveSection(i, 'up')}
													disabled={i === 0}
													tabindex="-1"
												>
													<ChevronUp class="w-3 h-3" />
												</button>
												<button
													type="button"
													class="btn btn-xs btn-primary join-item"
													title="Mover abajo"
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
												class="btn btn-xs btn-error btn-ghost"
												title="Eliminar sección"
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
					<p
						class="text-xs sm:text-sm text-right pr-2 {totalQuestions > MAX_TOTAL_QUESTIONS
							? 'text-error font-semibold'
							: 'text-gray-500'}"
					>
						Total de preguntas: {totalQuestions} / {MAX_TOTAL_QUESTIONS}
						{#if totalQuestions > MAX_TOTAL_QUESTIONS}
							<span class="text-error font-bold ml-1"> (Excedido!)</span>
						{/if}
					</p>
				{/if}

				<!-- Add Section Select -->
				<div class="mt-4 pt-4 border-t border-base-300">
					<label for="add-course-select" class="label font-medium text-sm pb-1">
						Agregar Curso a Secciones
					</label>
					<select
						id="add-course-select"
						bind:value={formState.selectedCourseCode}
						class="select select-bordered w-full"
						onchange={addSectionTrigger}
						disabled={availableCoursesForAdd.length === 0 || totalQuestions >= MAX_TOTAL_QUESTIONS}
					>
						<option value="" disabled selected>
							{#if availableCoursesForAdd.length === 0}
								No hay más cursos disponibles
							{:else if totalQuestions >= MAX_TOTAL_QUESTIONS}
								Límite de {MAX_TOTAL_QUESTIONS} preguntas alcanzado
							{:else}
								Selecciona un curso para agregar...
							{/if}
						</option>
						{#each availableCoursesForAdd as course (course.code)}
							{@const addingWouldExceed =
								totalQuestions + DEFAULT_QUESTIONS_PER_SECTION > MAX_TOTAL_QUESTIONS}
							<option
								value={course.code}
								disabled={addingWouldExceed}
								title={addingWouldExceed
									? `Agregar ${DEFAULT_QUESTIONS_PER_SECTION} preguntas excedería el límite`
									: ''}
							>
								{course.name}
								{#if addingWouldExceed}(No permitido){/if}
							</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Modal Actions -->
			<div class="flex justify-end gap-3 pt-4">
				<button type="button" class="btn btn-ghost" onclick={() => modal?.close()}>
					Cancelar
				</button>
				<button
					type="submit"
					class="btn btn-primary gap-2 hover:scale-105 transition-transform"
					disabled={totalQuestions > MAX_TOTAL_QUESTIONS ||
						formState.sections.length === 0 ||
						!formState.name ||
						!formState.eval_date ||
						!formState.level_code ||
						!formState.group_name}
				>
					{#if formState.selectedCode}
						<ClipboardEdit class="w-4 h-4" /> Actualizar
					{:else}
						<Plus class="w-4 h-4" /> Guardar
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
	<div class="modal-box bg-base-100">
		<h3 class="font-bold text-lg">Confirmar eliminación</h3>
		<p class="py-4">
			¿Estás seguro que deseas eliminar el examen
			<span class="font-semibold text-accent">{formState.selectForDelete?.name || ''}</span>? Esta
			acción no se puede deshacer.
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
