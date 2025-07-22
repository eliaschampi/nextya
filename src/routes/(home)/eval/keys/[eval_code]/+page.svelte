<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Message from '$lib/components/Message.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { can } from '$lib/stores/permissions';
	import { responseMessage } from '$lib/utils/responseMessage';
	import type { EvalQuestions, EvalSections, Evals } from '$lib/types';
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

	// Constants
	const DEFAULT_OMITABLE = false;
	const DEFAULT_SCORE = 1.0;
	const ANSWER_OPTIONS = ['A', 'B', 'C', 'D', 'E'] as const;

	// Props
	const { data } = $props<{
		data: {
			eval: Evals & { levels: { name: string } };
			sections: (EvalSections & { course_name: string })[];
			existingQuestions: EvalQuestions[];
			title: string;
		};
	}>();

	// Permissions
	let canUpsert = $derived(can('keys:upsert'));

	// State
	let activeTab = $state(0);
	let message = $state('');
	let isSaving = $state(false);
	let isCreateMode = $state(false);
	let sectionQuestions = $state<Record<string, EvalQuestions[]>>({});
	let sectionStarts = $state<Record<string, number>>({});
	let pasteModal = $state<HTMLDialogElement | null>(null);
	let pasteContent = $state('');
	let pasteError = $state('');

	// Derived
	let totalQuestions = $derived(Object.values(sectionQuestions).flat().length);
	let answeredQuestions = $derived(
		Object.values(sectionQuestions)
			.flat()
			.filter((q) => q.correct_key !== '').length
	);
	let completionPercentage = $derived(
		totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0
	);
	let isValid = $derived(answeredQuestions === totalQuestions);

	// Lifecycle hooks
	onMount(() => {
		initializeData();
		setupEventListeners();
	});

	function setupEventListeners(): void {
		// Clean up modal content when it closes
		pasteModal?.addEventListener('close', () => {
			pasteContent = '';
			pasteError = '';
		});
	}

	function initializeData(): void {
		calculateSectionStarts();
		initializeQuestions();
		isCreateMode = data.existingQuestions.length === 0;
	}

	function calculateSectionStarts(): void {
		const starts: Record<string, number> = {};
		let currentStart = 1;

		data.sections.forEach((section: EvalSections) => {
			starts[section.code] = currentStart;
			currentStart += section.question_count;
		});

		sectionStarts = starts;
	}

	function initializeQuestions(): void {
		if (data.existingQuestions.length > 0) {
			initializeExistingQuestions();
		} else {
			createNewQuestions();
		}
	}

	function initializeExistingQuestions(): void {
		const grouped = data.existingQuestions.reduce(
			(acc: Record<string, EvalQuestions[]>, question: EvalQuestions) => {
				if (!acc[question.section_code]) {
					acc[question.section_code] = [];
				}
				acc[question.section_code].push(question);
				return acc;
			},
			{}
		);

		// Sort questions by order within each section
		for (const sectionCode in grouped) {
			grouped[sectionCode].sort(
				(a: { order_in_eval: number }, b: { order_in_eval: number }) =>
					a.order_in_eval - b.order_in_eval
			);
		}

		sectionQuestions = grouped;
	}

	function createNewQuestions(): void {
		const newSectionQuestions: Record<string, EvalQuestions[]> = {};

		data.sections.forEach((section: EvalSections) => {
			const sectionCode = section.code;
			const questions: EvalQuestions[] = [];
			const startNumber = sectionStarts[sectionCode] || 1;

			for (let i = 0; i < section.question_count; i++) {
				questions.push({
					code: crypto.randomUUID(),
					eval_code: data.eval.code,
					section_code: sectionCode,
					order_in_eval: startNumber + i,
					correct_key: '',
					omitable: DEFAULT_OMITABLE,
					score_percent: DEFAULT_SCORE.toString()
				});
			}

			newSectionQuestions[sectionCode] = questions;
		});

		sectionQuestions = newSectionQuestions;
	}

	function getSectionQuestionIndex(globalNumber: number, sectionCode: string): number {
		const start = sectionStarts[sectionCode] || 1;
		return globalNumber - start + 1;
	}

	function getSectionCompletionStatus(sectionCode: string): { completed: number; total: number } {
		const questions = sectionQuestions[sectionCode] || [];
		const completedCount = questions.filter((q) => q.correct_key !== '').length;
		return { completed: completedCount, total: questions.length };
	}

	function prepareFormData(): FormData {
		const formData = new FormData();

		Object.entries(sectionQuestions).forEach(([sectionCode, questions]) => {
			questions.forEach((question) => {
				const localIndex = getSectionQuestionIndex(question.order_in_eval, sectionCode);
				const questionKey = `question_${sectionCode}_${localIndex}`;
				const omitableKey = `omitable_${sectionCode}_${localIndex}`;
				const scoreKey = `score_${sectionCode}_${localIndex}`;

				formData.set(questionKey, question.correct_key);
				if (question.omitable) formData.set(omitableKey, 'on');
				formData.set(scoreKey, question.score_percent.toString());
			});
		});

		return formData;
	}

	async function submitForm(formData: FormData) {
		const response = await fetch('?/saveQuestions', {
			method: 'POST',
			body: formData
		});
		return response.json();
	}

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		if (!canUpsert) return;

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

	function updateQuestion<K extends keyof EvalQuestions>(
		sectionCode: string,
		question: EvalQuestions,
		field: K,
		value: EvalQuestions[K]
	): void {
		const sectionArr = [...(sectionQuestions[sectionCode] || [])];
		const index = sectionArr.findIndex((q) => q.order_in_eval === question.order_in_eval);

		if (index !== -1) {
			sectionArr[index] = { ...sectionArr[index], [field]: value };
			sectionQuestions = { ...sectionQuestions, [sectionCode]: sectionArr };
		}
	}

	function handleRadioChange(section: string, question: EvalQuestions, value: string): void {
		// If the selected value is equal to the current value, clear it (toggle behavior)
		const newValue = question.correct_key === value ? '' : value;
		updateQuestion(section, question, 'correct_key', newValue);
	}

	function handleOmitableChange(section: string, question: EvalQuestions, checked: boolean): void {
		updateQuestion(section, question, 'omitable', checked);
	}

	function handleScoreChange(section: string, question: EvalQuestions, value: string): void {
		const score = parseFloat(value);
		if (isNaN(score) || score < 0 || score > 1) return;
		updateQuestion(section, question, 'score_percent', score.toString());
	}

	function navigateTab(direction: 'next' | 'prev'): void {
		if (direction === 'next' && activeTab < data.sections.length - 1) {
			activeTab++;
		} else if (direction === 'prev' && activeTab > 0) {
			activeTab--;
		}
	}

	async function copyAllKeys(): Promise<void> {
		try {
			// Get all questions sorted by their global order
			const allQuestions = Object.values(sectionQuestions)
				.flat()
				.sort((a, b) => a.order_in_eval - b.order_in_eval);

			// Create a string of all answer keys
			const keysString = allQuestions.map((q) => q.correct_key).join('');

			// Copy to clipboard
			await navigator.clipboard.writeText(keysString);
			showToast('Claves copiadas al portapapeles', 'success');
		} catch (err) {
			console.error('Error al copiar claves:', err);
			showToast('Error al copiar claves', 'warning');
		}
	}

	function validatePasteContent(content: string): boolean {
		// Validate that content only contains A-E characters
		if (!/^[A-E]+$/.test(content)) {
			pasteError = 'El contenido pegado solo debe contener letras A, B, C, D o E';
			return false;
		}

		// Validate content length: min 1, max total questions
		if (content.length < 1) {
			pasteError = 'Debe ingresar al menos 1 respuesta';
			return false;
		}
		if (content.length > totalQuestions) {
			pasteError = `La longitud del contenido (${content.length}) excede el número total de preguntas (${totalQuestions})`;
			return false;
		}

		return true;
	}

	function applyPastedKeys(): void {
		if (!validatePasteContent(pasteContent)) return;

		// Sort all questions by their global order
		const allQuestions = Object.values(sectionQuestions)
			.flat()
			.sort((a, b) => a.order_in_eval - b.order_in_eval);

		// Apply the keys to questions up to the length of pasted content
		const keysToApply = Math.min(pasteContent.length, allQuestions.length);
		for (let i = 0; i < keysToApply; i++) {
			const question = allQuestions[i];
			updateQuestion(question.section_code, question, 'correct_key', pasteContent[i]);
		}

		// Close modal and show success message
		pasteModal?.close();
		pasteContent = '';
		pasteError = '';

		showToast(
			keysToApply === totalQuestions
				? 'Claves aplicadas correctamente'
				: `${keysToApply} de ${totalQuestions} claves aplicadas`,
			'success'
		);
	}

	function openPasteModal(): void {
		pasteContent = '';
		pasteError = '';
		pasteModal?.showModal();
	}

	function closePasteModal(): void {
		pasteModal?.close();
		pasteContent = '';
		pasteError = '';
	}

	function clearAllKeys(): void {
		// Iterate through all sections and questions to clear keys
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

<!-- Progress Header -->
<div class="mb-6 flex flex-col lg:flex-row gap-4 items-stretch">
	<!-- Progress Card -->
	<div class="card bg-base-200/80 shadow border border-base-300 flex-1">
		<div class="card-body p-4">
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-sm font-medium text-base-content/70">Progreso Total</h3>
				<div class="badge badge-ghost text-xs">
					{answeredQuestions} / {totalQuestions}
				</div>
			</div>

			<div class="flex items-center gap-3 mb-3">
				<span class="text-2xl font-bold text-primary">{Math.round(completionPercentage)}%</span>
				<progress class="progress progress-primary flex-1" value={completionPercentage} max="100"
				></progress>
			</div>

			<!-- Action Buttons -->
			<div class="flex gap-2">
				{#if completionPercentage === 100}
					<div class="tooltip" data-tip="Copiar todas las claves">
						<button type="button" class="btn btn-sm btn-ghost" onclick={copyAllKeys}>
							<Copy size={16} />
						</button>
					</div>
				{/if}

				{#if isCreateMode}
					<div class="tooltip" data-tip="Pegar claves desde portapapeles">
						<button type="button" class="btn btn-sm btn-ghost" onclick={openPasteModal}>
							<Clipboard size={16} />
						</button>
					</div>
				{/if}

				<div class="tooltip" data-tip="Limpiar todas las claves">
					<button type="button" class="btn btn-sm btn-error" onclick={clearAllKeys}>
						<Eraser size={16} />
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Save Button -->
	<div class="flex items-end">
		<button
			type="submit"
			form="keysForm"
			class="btn {isValid ? 'btn-success' : 'btn-primary'} gap-2 min-w-40"
			disabled={!isValid || isSaving || !canUpsert}
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
</div>

<!-- Main Content -->
<div class="card bg-base-200/60 shadow border border-base-300">
	<div class="card-body p-0">
		<form id="keysForm" onsubmit={handleSubmit}>
			<!-- Section Tabs -->
			<div class="tabs tabs-box px-4 pt-4">
				{#each data.sections as section, i (section.code)}
					{@const status = getSectionCompletionStatus(section.code)}
					{@const isComplete = status.completed === status.total}
					{@const sectionStart = sectionStarts[section.code] || 1}
					{@const sectionEnd = sectionStart + section.question_count - 1}
					<button
						type="button"
						class="tab tab-lg gap-2 {activeTab === i ? 'tab-active' : ''}"
						onclick={() => (activeTab = i)}
					>
						<span class="font-medium">{section.course_name}</span>
						<div class="badge badge-sm {isComplete ? 'badge-success' : 'badge-outline'}">
							{status.completed}/{status.total}
						</div>
						<span class="text-xs opacity-60 hidden lg:inline">
							({sectionStart}-{sectionEnd})
						</span>
					</button>
				{/each}
			</div>

			<!-- Alert Message -->
			{#if message}
				<div class="px-4 pt-4">
					<Message type="error" description={message} />
				</div>
			{/if}

			<!-- Questions Section -->
			{#each data.sections as section, i (section.code)}
				{#if activeTab === i}
					<div class="p-4 space-y-4">
						<!-- Section Header -->
						<div class="flex items-center justify-between">
							<h3 class="text-lg font-semibold flex items-center gap-2 text-primary">
								<BookOpen size={20} />
								{section.course_name}
							</h3>
							<div class="badge badge-soft">Seleccione la respuesta correcta</div>
						</div>

						<!-- Questions Grid -->
						<div class="space-y-3">
							{#each sectionQuestions[section.code] || [] as question (question.code)}
								{@const localIndex = getSectionQuestionIndex(question.order_in_eval, section.code)}
								{@const questionId = `question_${section.code}_${localIndex}`}
								{@const omitableId = `omitable_${section.code}_${localIndex}`}
								{@const scoreId = `score_${section.code}_${localIndex}`}
								{@const hasAnswer = question.correct_key !== ''}

								<div class="card bg-base-50 {hasAnswer ? 'ring-1 ring-success/20' : ''}">
									<div class="card-body p-4">
										<div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
											<!-- Question Number -->
											<div class="lg:col-span-2 flex items-center gap-3">
												<div
													class="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center"
												>
													<span class="font-bold text-lg {hasAnswer ? 'text-success' : ''}">
														{question.order_in_eval}
													</span>
												</div>
												{#if hasAnswer}
													<div class="badge badge-success lg:hidden">
														{question.correct_key}
													</div>
												{/if}
											</div>

											<!-- Answer Options -->
											<div class="lg:col-span-6 flex gap-2 justify-center lg:justify-start">
												{#each ANSWER_OPTIONS as option (option)}
													<label
														class="flex items-center justify-center w-10 h-10 rounded-full cursor-pointer select-none
															{question.correct_key === option
															? 'bg-primary text-primary-content scale-105'
															: 'bg-base-200 hover:bg-base-300 text-base-content'}"
													>
														<input
															type="radio"
															name={questionId}
															value={option}
															class="sr-only"
															checked={question.correct_key === option}
															onchange={() => handleRadioChange(section.code, question, option)}
														/>
														<span class="font-semibold">{option}</span>
													</label>
												{/each}
											</div>

											<!-- Optional Toggle -->
											<div class="lg:col-span-2 flex justify-center">
												<label class="label cursor-pointer gap-2">
													<input
														type="checkbox"
														name={omitableId}
														class="toggle toggle-success toggle-sm"
														checked={question.omitable}
														onchange={(e) =>
															handleOmitableChange(
																section.code,
																question,
																(e.target as HTMLInputElement).checked
															)}
													/>
													<span class="label-text text-xs">Opcional</span>
												</label>
											</div>

											<!-- Score Input -->
											<div class="lg:col-span-2 flex items-center gap-2 justify-end">
												<label for={scoreId} class="label-text text-xs">Valor:</label>
												<input
													id={scoreId}
													type="number"
													name={scoreId}
													min="0"
													max="1"
													step="0.01"
													class="input input-sm input-bordered w-16 text-center"
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
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/each}

			<!-- Navigation -->
			<div class="flex justify-between items-center p-4 bg-base-100">
				<button
					type="button"
					class="btn btn-dash btn-accent gap-2"
					disabled={activeTab === 0}
					onclick={() => navigateTab('prev')}
				>
					<ChevronLeft size={18} />
					Anterior
				</button>

				<div class="text-sm text-base-content/60">
					Sección {activeTab + 1} de {data.sections.length}
				</div>

				<button
					type="button"
					class="btn btn-dash btn-accent gap-2"
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

<!-- Paste Keys Modal -->
<dialog bind:this={pasteModal} class="modal">
	<div class="modal-box">
		<form method="dialog">
			<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
				<X size={18} />
			</button>
		</form>

		<div class="flex items-center gap-3 mb-6">
			<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
				<Clipboard size={20} class="text-primary" />
			</div>
			<h3 class="text-xl font-semibold">Pegar Claves</h3>
		</div>

		<div class="bg-base-200 p-4 rounded-lg opacity-80">
			<div class="text-sm">
				<p class="font-medium mb-1 text-primary">Formato esperado:</p>
				<p>
					Ingrese las respuestas como <code class="bg-base-100 px-1 rounded">ABCDEABCD...</code>
				</p>
				<i>
					Rango: <span class="badge badge-outline badge-sm">1</span> a
					<span class="badge badge-primary badge-sm">{totalQuestions}</span> caracteres. Las claves se
					aplicarán secuencialmente.
				</i>
			</div>
		</div>

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Claves de respuesta</legend>
			<textarea
				id="pasteInput"
				class="textarea textarea-bordered w-full font-mono text-lg tracking-wider"
				placeholder="ABCDEABCDABCD..."
				bind:value={pasteContent}
			></textarea>
			{#if pasteError}
				<div class="label">
					<span class="label-text-alt text-error">{pasteError}</span>
				</div>
			{/if}
		</fieldset>

		<div class="modal-action">
			<button class="btn btn-outline" onclick={closePasteModal}> Cancelar </button>
			<button class="btn btn-primary" onclick={applyPastedKeys} disabled={!pasteContent.trim()}>
				<Check size={18} />
				Aplicar Claves
			</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>cerrar</button>
	</form>
</dialog>
