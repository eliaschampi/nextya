<script lang="ts">
	import { goto } from '$app/navigation';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Message from '$lib/components/Message.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { BookOpen, Save, ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import type { EvalQuestion, EvalSection, Eval } from '../../../../../app';

	const { data } = $props<{
		data: {
			eval: Eval & { levels: { name: string } };
			sections: (EvalSection & { course_name: string })[];
			existingQuestions: EvalQuestion[];
			title: string;
		};
	}>();

	// Group questions by section and calculate offsets
	let sectionQuestions = $state<Record<string, EvalQuestion[]>>({});
	let sectionStarts = $state<Record<string, number>>({});

	// State for tracking form data
	let activeTab = $state(0);
	let message = $state('');
	let isSaving = $state(false);

	// Options for radio buttons
	const options = ['A', 'B', 'C', 'D', 'E'];

	// Derived values for form validation
	let isValid = $derived(validateForm());
	let completionPercentage = $derived(getCompletionPercentage());

	// Constants
	const DEFAULT_OMITABLE = false;
	const DEFAULT_SCORE = 1.0;

	// Initialize form data
	$effect(() => {
		if (Object.keys(sectionStarts).length === 0) {
			calculateSectionStarts();
		}
	});

	$effect(() => {
		if (Object.keys(sectionQuestions).length === 0) {
			initializeQuestions();
		}
	});

	// Calculate starting points for each section for global numbering
	function calculateSectionStarts() {
		const starts: Record<string, number> = {};
		let currentStart = 1;

		data.sections.forEach((section: EvalSection) => {
			starts[section.code] = currentStart;
			currentStart += section.question_count;
		});

		sectionStarts = starts;
	}

	// Initialize questions from existing data or create new ones
	function initializeQuestions() {
		if (data.existingQuestions.length > 0) {
			// Group and sort existing questions by section
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

			// Sort questions within each section
			for (const sectionCode in grouped) {
				grouped[sectionCode].sort(
					(a: EvalQuestion, b: EvalQuestion) => a.order_in_eval - b.order_in_eval
				);
			}

			sectionQuestions = grouped;
		} else {
			// Create empty questions for each section with global numbering
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

	// Get the internal order within a section
	function getSectionQuestionIndex(globalNumber: number, sectionCode: string): number {
		const start = sectionStarts[sectionCode] || 1;
		return globalNumber - start + 1;
	}

	// Calculate completion percentage
	function getCompletionPercentage(): number {
		const allQuestions = Object.values(sectionQuestions).flat();
		const answeredCount = allQuestions.filter((q) => q.correct_key !== '').length;
		return allQuestions.length > 0 ? (answeredCount / allQuestions.length) * 100 : 0;
	}

	// Validate the form
	function validateForm(): boolean {
		const allSections = Object.values(sectionQuestions).flat();
		return allSections.every((q) => q.correct_key !== '');
	}

	// Get completion status for a section
	function getSectionCompletionStatus(sectionCode: string): { completed: number; total: number } {
		const questions = sectionQuestions[sectionCode] || [];
		const completedCount = questions.filter((q) => q.correct_key !== '').length;
		return { completed: completedCount, total: questions.length };
	}

	// Handle form submission
	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();

		if (!isValid) {
			message = 'Debe seleccionar una respuesta para cada pregunta.';
			return;
		}

		isSaving = true;

		try {
			const formData = new FormData();

			// Include all questions from all sections
			Object.entries(sectionQuestions).forEach(([sectionCode, questions]) => {
				questions.forEach((question) => {
					const localIndex = getSectionQuestionIndex(question.order_in_eval, sectionCode);

					const fieldIds = {
						question: `question_${sectionCode}_${localIndex}`,
						omitable: `omitable_${sectionCode}_${localIndex}`,
						score: `score_${sectionCode}_${localIndex}`
					};

					formData.set(fieldIds.question, question.correct_key);

					if (question.omitable) {
						formData.set(fieldIds.omitable, 'on');
					}

					formData.set(fieldIds.score, question.score_percent.toString());
				});
			});

			const response = await fetch('?/saveQuestions', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				showToast('Claves guardadas exitosamente', 'success');
				goto('/eval');
			} else {
				message = responseMessage(result) || 'Error al guardar las claves';
				isSaving = false;
			}
		} catch (err) {
			message = 'Error al procesar la solicitud';
			console.error(err);
			isSaving = false;
		}
	}

	// Update question answer choice
	function updateQuestion<K extends keyof EvalQuestion>(
		sectionCode: string,
		question: EvalQuestion,
		field: K,
		value: EvalQuestion[K]
	) {
		const sectionArr = [...(sectionQuestions[sectionCode] || [])];
		const index = sectionArr.findIndex((q) => q.order_in_eval === question.order_in_eval);

		if (index !== -1) {
			// Create a new question object with the updated value
			sectionArr[index] = {
				...sectionArr[index],
				[field]: value
			};

			// Update state
			sectionQuestions = {
				...sectionQuestions,
				[sectionCode]: sectionArr
			};
		}
	}

	// Handle radio change
	function handleRadioChange(section: string, question: EvalQuestion, value: string) {
		updateQuestion(section, question, 'correct_key', value);
	}

	// Handle toggle omitable
	function handleOmitableChange(section: string, question: EvalQuestion, checked: boolean) {
		updateQuestion(section, question, 'omitable', checked);
	}

	// Handle score change
	function handleScoreChange(section: string, question: EvalQuestion, value: string) {
		const score = parseFloat(value);
		if (isNaN(score) || score < 0 || score > 1) return;

		updateQuestion(section, question, 'score_percent', score);
	}

	// Navigation between tabs
	function navigateTab(direction: 'next' | 'prev') {
		if (direction === 'next' && activeTab < data.sections.length - 1) {
			activeTab++;
		} else if (direction === 'prev' && activeTab > 0) {
			activeTab--;
		}
	}
</script>

<PageTitle
	title={data.eval.name}
	description={`Asignar claves - ${data.eval.levels.name} - Grupo ${data.eval.group_name}`}
>
	<a href="/eval" class="btn btn-outline gap-1 hover:bg-base-200 transition-all duration-300">
		<ArrowLeft size={18} />
		Volver
	</a>
</PageTitle>

<!-- Progress and Save Button -->
<div class="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
	<div
		class="card bg-base-100 shadow hover:shadow-md transition-all duration-300 flex-1 w-full sm:w-auto"
	>
		<div class="p-4 flex flex-col">
			<span class="text-sm text-base-content/70">Progreso Total</span>
			<div class="flex items-center justify-between mt-1 mb-2">
				<span class="font-semibold text-lg">{Math.round(completionPercentage)}%</span>
				<span class="text-xs badge badge-ghost">
					{Object.values(sectionQuestions)
						.flat()
						.filter((q) => q.correct_key !== '').length} /
					{Object.values(sectionQuestions).flat().length} preguntas
				</span>
			</div>
			<div class="relative h-3 w-full bg-base-200 rounded-full overflow-hidden">
				<div
					class="absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out {completionPercentage ===
					100
						? 'bg-success'
						: 'bg-primary'}"
					style="width: {completionPercentage}%"
				></div>
			</div>
		</div>
	</div>

	<button
		type="submit"
		form="keysForm"
		class="btn {isValid
			? 'btn-success'
			: 'btn-primary'} gap-2 w-full sm:w-auto shadow hover:shadow-lg transition-all duration-300"
		disabled={!isValid || isSaving}
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

<!-- Main Content -->
<div class="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 mx-auto">
	<div class="card-body p-4 sm:p-6">
		<form id="keysForm" class="space-y-6" onsubmit={handleSubmit}>
			<!-- Section Tabs -->
			<div class="bg-base-200 rounded-lg overflow-hidden shadow-inner">
				<div class="tabs tabs-boxed bg-base-300/50 p-1 overflow-x-auto flex flex-nowrap">
					{#each data.sections as section, i (section.code)}
						{@const status = getSectionCompletionStatus(section.code)}
						{@const isComplete = status.completed === status.total}
						{@const sectionStart = sectionStarts[section.code] || 1}
						{@const sectionEnd = sectionStart + section.question_count - 1}
						<button
							type="button"
							class="tab tab-lifted whitespace-nowrap gap-2 transition-all duration-300
								{activeTab === i ? 'tab-active font-medium' : ''} 
								{isComplete ? 'text-success' : ''}"
							onclick={() => (activeTab = i)}
						>
							<BookOpen size={16} class="inline-block" />
							<span>{section.course_name}</span>
							<span class="badge badge-sm {isComplete ? 'badge-success' : 'badge-ghost'} ml-1">
								{status.completed}/{status.total}
							</span>
							<span class="text-xs opacity-50">({sectionStart}-{sectionEnd})</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Alert Message -->
			{#if message}
				<div class="mt-4">
					<Message description={message} type="warning" />
				</div>
			{/if}

			<!-- Questions for Active Section -->
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
									class="py-4 grid grid-cols-1 md:grid-cols-6 gap-4 items-center
									{hasAnswer ? 'bg-success/5' : ''} rounded-lg p-3 transition-all duration-300"
								>
									<!-- Question Number -->
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

									<!-- Answer Options -->
									<div class="md:col-span-3 flex flex-wrap gap-2 justify-center md:justify-start">
										{#each options as option (option)}
											<label
												class="flex items-center gap-2 cursor-pointer p-2 rounded-full
													transition-all duration-300 hover:bg-base-200
													{question.correct_key === option
													? 'bg-primary text-primary-content shadow-md'
													: 'bg-base-200 hover:shadow'}"
											>
												<input
													type="radio"
													name={questionId}
													value={option}
													class="radio radio-primary hidden"
													checked={question.correct_key === option}
													onchange={() => handleRadioChange(section.code, question, option)}
												/>
												<span class="font-medium text-lg px-3">{option}</span>
											</label>
										{/each}
									</div>

									<!-- Omitable Option -->
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
											<div class="swap-on flex gap-2 items-center">
												<span class="label-text">Omitible</span>
												<div class="badge badge-primary badge-sm">Sí</div>
											</div>
											<div class="swap-off flex gap-2 items-center">
												<span class="label-text">Omitible</span>
												<div class="badge badge-outline badge-sm">No</div>
											</div>
										</label>
									</div>

									<!-- Score Value -->
									<div class="md:col-span-1 flex items-center justify-end gap-2">
										<span class="text-xs font-medium">Valor</span>
										<input
											type="number"
											name={scoreId}
											min="0"
											max="1"
											step="0.01"
											class="input input-sm input-bordered w-20 text-center focus:input-primary transition-all duration-300"
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

			<!-- Navigation Buttons -->
			<div class="pt-4 border-t border-base-300 flex justify-between">
				<button
					type="button"
					class="btn btn-outline btn-sm gap-2 hover:bg-base-200 transition-all duration-300"
					disabled={activeTab === 0}
					onclick={() => navigateTab('prev')}
				>
					<ChevronLeft size={18} />
					Anterior
				</button>

				<button
					type="button"
					class="btn btn-outline btn-sm gap-2 hover:bg-base-200 transition-all duration-300"
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

<style>
	.tab {
		transition: all 0.25s ease;
	}
	.tab-active {
		transform: translateY(-3px);
		font-weight: 500;
	}
</style>
