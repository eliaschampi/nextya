<script lang="ts">
	import { goto } from '$app/navigation';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { responseMessage } from '$lib/utils/responseMessage';
	import {
		BookOpen,
		Save,
		ArrowLeft,
		Check,
		ChevronLeft,
		ChevronRight,
		Copy,
		Clipboard,
		X,
		Eraser
	} from 'lucide-svelte';
	import type { EvalQuestion, EvalSection, Eval } from '$lib/types';
	import { onMount } from 'svelte';
	import Message from '$lib/components/Message.svelte';
	import { permissionsStore } from '$lib/stores/permissions';

	const canCreate = permissionsStore.has({ entity: 'eval_questions', action: 'create' });

	// Props recibidos
	const { data } = $props<{
		data: {
			eval: Eval & { levels: { name: string } };
			sections: (EvalSection & { course_name: string })[];
			existingQuestions: EvalQuestion[];
			title: string;
		};
	}>();

	// Estado reactivo
	let sectionQuestions = $state<Record<string, EvalQuestion[]>>({});
	let sectionStarts = $state<Record<string, number>>({});
	let activeTab = $state(0);
	let message = $state('');
	let isSaving = $state(false);
	let pasteModal = $state<HTMLDialogElement | null>(null);
	let pasteContent = $state('');
	let pasteError = $state('');
	let isCreateMode = $state(false);

	// Opciones de respuesta
	const options = ['A', 'B', 'C', 'D', 'E'];

	// Valores derivados
	let isValid = $derived(validateForm());
	let completionPercentage = $derived(getCompletionPercentage());

	// Constantes
	const DEFAULT_OMITABLE = false;
	const DEFAULT_SCORE = 1.0;

	// Inicialización al montar el componente
	onMount(() => {
		initialize();

		// Limpiar el contenido del modal cuando se cierra
		pasteModal?.addEventListener('close', () => {
			pasteContent = '';
			pasteError = '';
		});
	});

	/** Inicializa las preguntas y los puntos de inicio de las secciones */
	function initialize() {
		calculateSectionStarts();
		initializeQuestions();
		isCreateMode = data.existingQuestions.length === 0;
	}

	/** Calcula los puntos de inicio de cada sección para numeración global */
	function calculateSectionStarts() {
		const starts: Record<string, number> = {};
		let currentStart = 1;

		data.sections.forEach((section: EvalSection) => {
			starts[section.code] = currentStart;
			currentStart += section.question_count;
		});

		sectionStarts = starts;
	}

	/** Inicializa las preguntas existentes o crea nuevas */
	function initializeQuestions() {
		if (data.existingQuestions.length > 0) {
			const grouped = data.existingQuestions.reduce(
				(acc: Record<string, EvalQuestion[]>, question: EvalQuestion) => {
					if (!acc[question.section_code]) {
						acc[question.section_code] = [];
					}
					acc[question.section_code].push(question);
					return acc;
				},
				{}
			);

			for (const sectionCode in grouped) {
				grouped[sectionCode].sort(
					(a: { order_in_eval: number }, b: { order_in_eval: number }) =>
						a.order_in_eval - b.order_in_eval
				);
			}

			sectionQuestions = grouped;
		} else {
			const newSectionQuestions: Record<string, EvalQuestion[]> = {};

			data.sections.forEach((section: EvalSection) => {
				const sectionCode = section.code;
				const questions: EvalQuestion[] = [];
				const startNumber = sectionStarts[sectionCode] || 1;

				for (let i = 0; i < section.question_count; i++) {
					questions.push({
						code: crypto.randomUUID(),
						eval_code: data.eval.code,
						section_code: sectionCode,
						order_in_eval: startNumber + i,
						correct_key: '',
						omitable: DEFAULT_OMITABLE,
						score_percent: DEFAULT_SCORE
					});
				}

				newSectionQuestions[sectionCode] = questions;
			});

			sectionQuestions = newSectionQuestions;
		}
	}

	/** Obtiene el índice local de una pregunta dentro de su sección */
	function getSectionQuestionIndex(globalNumber: number, sectionCode: string): number {
		const start = sectionStarts[sectionCode] || 1;
		return globalNumber - start + 1;
	}

	/** Calcula el porcentaje de completitud */
	function getCompletionPercentage(): number {
		const allQuestions = Object.values(sectionQuestions).flat();
		const answeredCount = allQuestions.filter((q) => q.correct_key !== '').length;
		return allQuestions.length > 0 ? (answeredCount / allQuestions.length) * 100 : 0;
	}

	/** Valida el formulario */
	function validateForm(): boolean {
		const allSections = Object.values(sectionQuestions).flat();
		return allSections.every((q) => q.correct_key !== '');
	}

	/** Obtiene el estado de completitud de una sección */
	function getSectionCompletionStatus(sectionCode: string): { completed: number; total: number } {
		const questions = sectionQuestions[sectionCode] || [];
		const completedCount = questions.filter((q) => q.correct_key !== '').length;
		return { completed: completedCount, total: questions.length };
	}

	/** Prepara los datos del formulario para enviar */
	function prepareFormData(): FormData {
		const formData = new FormData();
		Object.entries(sectionQuestions).forEach(([sectionCode, questions]) => {
			questions.forEach((question) => {
				const localIndex = getSectionQuestionIndex(question.order_in_eval, sectionCode);
				formData.set(`question_${sectionCode}_${localIndex}`, question.correct_key);
				if (question.omitable) formData.set(`omitable_${sectionCode}_${localIndex}`, 'on');
				formData.set(`score_${sectionCode}_${localIndex}`, question.score_percent.toString());
			});
		});
		return formData;
	}

	/** Envía los datos al servidor */
	async function submitForm(formData: FormData) {
		const response = await fetch('?/saveQuestions', { method: 'POST', body: formData });
		return response.json();
	}

	/** Maneja el envío del formulario */
	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!isValid) {
			message = 'Debe seleccionar una respuesta para cada pregunta.';
			return;
		}
		isSaving = true;
		try {
			const formData = prepareFormData();
			const result = await submitForm(formData);
			if (result.type === 'success') {
				showToast('Claves guardadas exitosamente', 'success');
				goto('/eval');
			} else {
				message = responseMessage(result) || 'Error al guardar las claves';
			}
		} catch (err) {
			message = 'Error al procesar la solicitud';
			console.error(err);
		} finally {
			isSaving = false;
		}
	}

	/** Actualiza una propiedad de una pregunta */
	function updateQuestion<K extends keyof EvalQuestion>(
		sectionCode: string,
		question: EvalQuestion,
		field: K,
		value: EvalQuestion[K]
	) {
		const sectionArr = [...(sectionQuestions[sectionCode] || [])];
		const index = sectionArr.findIndex((q) => q.order_in_eval === question.order_in_eval);
		if (index !== -1) {
			sectionArr[index] = { ...sectionArr[index], [field]: value };
			sectionQuestions = { ...sectionQuestions, [sectionCode]: sectionArr };
		}
	}

	/** Maneja el cambio en las opciones de respuesta */
	function handleRadioChange(section: string, question: EvalQuestion, value: string) {
		updateQuestion(section, question, 'correct_key', value);
	}

	/** Maneja el cambio en la opción omitible */
	function handleOmitableChange(section: string, question: EvalQuestion, checked: boolean) {
		updateQuestion(section, question, 'omitable', checked);
	}

	/** Maneja el cambio en el valor de puntaje */
	function handleScoreChange(section: string, question: EvalQuestion, value: string) {
		const score = parseFloat(value);
		if (isNaN(score) || score < 0 || score > 1) return;
		updateQuestion(section, question, 'score_percent', score);
	}

	/** Navega entre pestañas */
	function navigateTab(direction: 'next' | 'prev') {
		if (direction === 'next' && activeTab < data.sections.length - 1) {
			activeTab++;
		} else if (direction === 'prev' && activeTab > 0) {
			activeTab--;
		}
	}

	/** Copia todas las claves al portapapeles */
	async function copyAllKeys() {
		try {
			const allQuestions = Object.values(sectionQuestions)
				.flat()
				.sort((a, b) => a.order_in_eval - b.order_in_eval);
			const keysString = allQuestions.map((q) => q.correct_key).join('');

			await navigator.clipboard.writeText(keysString);
			showToast('Claves copiadas al portapapeles', 'success');
		} catch (err) {
			console.error('Error al copiar claves:', err);
			showToast('Error al copiar claves', 'warning');
		}
	}

	/** Valida el contenido pegado */
	function validatePasteContent(content: string): boolean {
		// Verificar que solo contenga caracteres A-E
		const validCharsRegex = /^[A-E]+$/;
		if (!validCharsRegex.test(content)) {
			pasteError = 'El contenido pegado solo debe contener letras A, B, C, D o E';
			return false;
		}

		// Verificar que la longitud coincida con el número total de preguntas
		const totalQuestions = Object.values(sectionQuestions).flat().length;
		if (content.length !== totalQuestions) {
			pasteError = `La longitud del contenido (${content.length}) no coincide con el número total de preguntas (${totalQuestions})`;
			return false;
		}

		return true;
	}

	/** Aplica las claves pegadas a las preguntas */
	function applyPastedKeys() {
		if (!validatePasteContent(pasteContent)) {
			return;
		}

		// Ordenar todas las preguntas por order_in_eval
		const allQuestions = Object.values(sectionQuestions)
			.flat()
			.sort((a, b) => a.order_in_eval - b.order_in_eval);

		// Aplicar las claves
		for (let i = 0; i < allQuestions.length; i++) {
			const question = allQuestions[i];
			const key = pasteContent[i];
			updateQuestion(question.section_code, question, 'correct_key', key);
		}

		pasteModal?.close();
		pasteContent = '';
		pasteError = '';
		showToast('Claves aplicadas correctamente', 'success');
	}

	/** Abre el modal de pegar claves */
	function openPasteModal() {
		pasteContent = '';
		pasteError = '';
		pasteModal?.showModal();
	}

	/** Cierra el modal de pegar claves */
	function closePasteModal() {
		pasteModal?.close();
		pasteContent = '';
		pasteError = '';
	}

	/** Limpia todas las claves seleccionadas */
	function clearAllKeys() {
		// Recorrer todas las secciones y limpiar las claves
		Object.entries(sectionQuestions).forEach(([sectionCode, questions]) => {
			questions.forEach((question) => {
				updateQuestion(sectionCode, question, 'correct_key', '');
			});
		});

		showToast('Todas las claves han sido limpiadas', 'success');
	}
</script>

<PageTitle
	title={data.eval.name}
	description={`Asignar claves - ${data.eval.levels.name} - Grupo ${data.eval.group_name}`}
>
	<a href="/eval" class="btn btn-outline gap-1 hover:bg-base-200">
		<ArrowLeft size={18} />
		Volver
	</a>
</PageTitle>

<!-- Progreso y Botón de Guardar -->
<div class="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
	<div class="card bg-base-200/70 flex-1 w-full sm:w-auto">
		<div class="p-4 flex flex-col">
			<span class="text-sm text-base-content/70">Progreso Total</span>
			<div class="flex items-center justify-between mt-1 mb-2">
				<span class="font-semibold text-xl">{Math.round(completionPercentage)}%</span>
				<span class="text-xs badge badge-ghost">
					{Object.values(sectionQuestions)
						.flat()
						.filter((q) => q.correct_key !== '').length} /
					{Object.values(sectionQuestions).flat().length} preguntas
				</span>
			</div>
			<div class="relative h-3 w-full bg-base-200 rounded-full overflow-hidden">
				<div
					class="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-primary to-primary/70"
					style="width: {completionPercentage}%"
				></div>
			</div>

			<!-- Botones de Copiar/Pegar/Limpiar -->
			<div class="flex flex-wrap gap-2 mt-3">
				{#if completionPercentage === 100}
					<button
						type="button"
						class="btn btn-sm btn-outline gap-1 tooltip"
						onclick={copyAllKeys}
						data-tip="Copiar Claves"
					>
						<Copy size={16} />
					</button>
				{/if}

				{#if isCreateMode}
					<button
						type="button"
						class="btn btn-sm btn-outline gap-1 tooltip"
						onclick={openPasteModal}
						data-tip="Pegar Claves"
					>
						<Clipboard size={16} />
					</button>
				{/if}

				<button
					type="button"
					class="btn btn-sm btn-outline btn-error gap-1 tooltip"
					onclick={clearAllKeys}
					data-tip="Limpiar Claves"
				>
					<Eraser size={16} />
				</button>
			</div>
		</div>
	</div>

	<button
		type="submit"
		form="keysForm"
		class="btn btn-md {isValid ? 'btn-success' : 'btn-primary'} gap-2 w-full sm:w-auto shadow"
		disabled={!isValid || isSaving || !$canCreate}
	>
		{#if isSaving}
			<span class="loading loading-spinner loading-sm"></span>
			Guardando...
		{:else if isValid}
			<Check size={18} />
			Guardar Claves
		{:else}
			<Save size={18} />
			Guardar
		{/if}
	</button>
</div>

<!-- Contenido Principal -->
<div class="card bg-base-200/90 border border-base-300 mx-auto">
	<div class="card-body p-4 sm:p-6">
		<form id="keysForm" class="space-y-8" onsubmit={handleSubmit}>
			<!-- Pestañas de Secciones -->
			<div class="rounded-lg overflow-hidden shadow-inner">
				<div class="tabs tabs-box bg-base-300/50 p-2 flex flex-wrap md:flex-nowrap overflow-x-auto">
					{#each data.sections as section, i (section.code)}
						{@const status = getSectionCompletionStatus(section.code)}
						{@const isComplete = status.completed === status.total}
						{@const sectionStart = sectionStarts[section.code] || 1}
						{@const sectionEnd = sectionStart + section.question_count - 1}
						<button
							type="button"
							class="tab flex-shrink-0 gap-1 whitespace-nowrap
								{activeTab === i ? 'tab-active font-medium bg-primary/10' : ''}
								{isComplete ? 'text-success' : 'text-base-content'}"
							onclick={() => (activeTab = i)}
						>
							<span>{section.course_name}</span>
							<span class="badge badge-sm {isComplete ? 'badge-success' : 'badge-outline'}">
								{status.completed}/{status.total}
							</span>
							<span class="text-xs opacity-50 hidden md:inline">({sectionStart}-{sectionEnd})</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Mensaje de Alerta -->
			{#if message}
				<Message type="error" description={message} />
			{/if}

			<!-- Preguntas de la Sección Activa -->
			{#each data.sections as section, i (section.code)}
				{#if activeTab === i}
					<div class="space-y-6 p-2">
						<div
							class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
						>
							<h3 class="text-lg font-semibold text-primary flex items-center gap-2">
								<BookOpen size={20} />
								{section.course_name}
							</h3>
							<div class="text-sm bg-base-200 px-4 py-1.5 rounded-full shadow-sm">
								Seleccione la respuesta correcta para cada pregunta
							</div>
						</div>

						<div class="divide-y divide-base-300">
							{#each sectionQuestions[section.code] || [] as question (question.code)}
								{@const localIndex = getSectionQuestionIndex(question.order_in_eval, section.code)}
								{@const questionId = `question_${section.code}_${localIndex}`}
								{@const omitableId = `omitable_${section.code}_${localIndex}`}
								{@const scoreId = `score_${section.code}_${localIndex}`}
								{@const hasAnswer = question.correct_key !== ''}

								<div
									class="py-3 grid grid-cols-1 md:grid-cols-6 gap-4 items-center
									{hasAnswer ? 'bg-primary/5' : ''} rounded-lg p-3"
								>
									<!-- Número de Pregunta -->
									<div class="md:col-span-1 flex items-center gap-2">
										<div class="flex flex-col items-center">
											<span
												class="text-xl font-semibold
												{hasAnswer ? 'text-success' : 'text-base-content'}"
											>
												{question.order_in_eval}
											</span>
										</div>
										{#if hasAnswer}
											<div class="badge badge-success ml-auto md:hidden">
												{question.correct_key}
											</div>
										{/if}
									</div>

									<!-- Opciones de Respuesta -->
									<div class="md:col-span-3 flex flex-wrap gap-2 justify-center md:justify-start">
										{#each options as option (option)}
											<label
												class="flex items-center gap-2 cursor-pointer p-1 rounded-full
													{question.correct_key === option
													? 'bg-primary text-white scale-105'
													: 'bg-base-200 hover:bg-base-300'}"
											>
												<input
													type="radio"
													name={questionId}
													value={option}
													class="radio radio-primary hidden"
													checked={question.correct_key === option}
													onchange={() => handleRadioChange(section.code, question, option)}
												/>
												<span class="font-medium px-2">{option}</span>
											</label>
										{/each}
									</div>

									<!-- Opción Omitible -->
									<div class="md:col-span-1 flex items-center justify-center">
										<label class="swap gap-2 items-center cursor-pointer">
											<input
												type="checkbox"
												name={omitableId}
												class="swap-input"
												checked={question.omitable}
												onchange={(e) =>
													handleOmitableChange(
														section.code,
														question,
														(e.target as HTMLInputElement).checked
													)}
											/>
											<div class="swap-on flex gap-2 items-center text-success">
												<span class="label-text">Opcional</span>
												<Check size={16} />
											</div>
											<div class="swap-off flex gap-2 items-center text-base-content/60">
												<span class="label-text">Obligatorio</span>
											</div>
										</label>
									</div>

									<!-- Valor de Puntaje -->
									<div class="md:col-span-1 flex items-center justify-end gap-2">
										<span class="text-xs font-medium">Valor</span>
										<input
											type="number"
											name={scoreId}
											min="0"
											max="1"
											step="0.01"
											placeholder="0.0-1.0"
											class="input input-sm input-bordered w-20 text-center focus:ring-2 focus:ring-primary"
											value={question.score_percent}
											oninput={(e) =>
												handleScoreChange(
													section.code,
													question,
													(e.target as HTMLInputElement).value
												)}
										/>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/each}

			<!-- Botones de Navegación -->
			<div class="pt-4 border-t border-base-300 flex justify-between">
				<button
					type="button"
					class="btn btn-accent btn-sm gap-2"
					disabled={activeTab === 0}
					onclick={() => navigateTab('prev')}
				>
					<ChevronLeft size={18} />
					Anterior
				</button>
				<button
					type="button"
					class="btn btn-accent btn-sm gap-2"
					disabled={activeTab === data.sections.length - 1}
					onclick={() => navigateTab('next')}
				>
					Siguiente
					<ChevronRight size={18} />
				</button>
			</div>
		</form>
	</div>
</div>

<!-- Modal para pegar claves -->
<dialog bind:this={pasteModal} class="modal">
	<div class="modal-box max-w-md">
		<button
			class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
			onclick={closePasteModal}
		>
			<X size={20} />
		</button>
		<h3 class="font-bold text-lg mb-4 flex items-center gap-2">
			<Clipboard size={20} />
			Pegar Claves
		</h3>

		<p class="text-sm mb-4">
			Pegue las claves en formato "ABCDEABCDABCD". Debe contener exactamente {Object.values(
				sectionQuestions
			).flat().length} caracteres (A-E).
		</p>

		<div class="form-control w-full">
			<textarea
				class="textarea textarea-bordered h-24 font-mono w-full"
				placeholder="ABCDEABCDABCD..."
				bind:value={pasteContent}
			></textarea>

			{#if pasteError}
				<div class="text-error text-sm mt-2">{pasteError}</div>
			{/if}
		</div>

		<div class="modal-action">
			<button class="btn btn-outline" onclick={closePasteModal}>Cancelar</button>
			<button class="btn btn-primary" onclick={applyPastedKeys} disabled={!pasteContent}>
				Aplicar
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop"><button>cerrar</button></form>
</dialog>

<style>
	.tab-active {
		font-weight: 500;
	}
</style>
