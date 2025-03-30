<script lang="ts">
	import { goto } from '$app/navigation';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Message from '$lib/components/Message.svelte';
	import { showToast } from '$lib/stores/Toast';
	import { responseMessage } from '$lib/utils/responseMessage';
	import { BookOpen, Save, ArrowLeft, Check } from 'lucide-svelte';
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
	let sectionQuestions = $state<{ [key: string]: EvalQuestion[] }>({});
	let sectionStarts = $state<{ [key: string]: number }>({});

	// State for tracking form data
	let activeTab = $state(0);
	let message = $state('');
	let isSaving = $state(false);

	// Options for radio buttons
	const options = ['A', 'B', 'C', 'D', 'E'];

	// State to track form validity
	let isValid = $derived(validateForm());
	let completionPercentage = $derived(getCompletionPercentage());

	// Default values for new questions
	const defaultOmitable = false;
	const defaultScore = 1.0;

	// Initialize form data
	$effect(() => {
		// Calcular los puntos de inicio de cada sección
		calculateSectionStarts();

		if (data.existingQuestions.length > 0) {
			// Agrupar preguntas existentes por sección
			const grouped = data.existingQuestions.reduce(
				(acc: { [key: string]: EvalQuestion[] }, question: EvalQuestion) => {
					if (!acc[question.section_code]) {
						acc[question.section_code] = [];
					}
					acc[question.section_code].push(question);
					return acc;
				},
				{} as { [key: string]: EvalQuestion[] }
			);

			// Ordenar preguntas dentro de cada sección
			for (const sectionCode in grouped) {
				grouped[sectionCode].sort(
					(a: EvalQuestion, b: EvalQuestion) => a.order_in_eval - b.order_in_eval
				);
			}

			sectionQuestions = grouped;
		} else {
			// Crear preguntas vacías para cada sección con numeración global
			const newSectionQuestions: { [key: string]: EvalQuestion[] } = {};

			data.sections.forEach((section: EvalSection & { course_name: string }) => {
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
						omitable: defaultOmitable,
						score_percent: defaultScore
					});
				}

				newSectionQuestions[sectionCode] = questions;
			});

			sectionQuestions = newSectionQuestions;
		}
	});

	// Calcular los puntos de inicio de cada sección para numeración global
	function calculateSectionStarts() {
		const starts: { [key: string]: number } = {};
		let currentStart = 1;

		data.sections.forEach((section: EvalSection & { course_name: string }) => {
			starts[section.code] = currentStart;
			currentStart += section.question_count;
		});

		sectionStarts = starts;
	}

	// Obtener el número de orden interno dentro de la sección
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
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (!isValid) {
			message = 'Debe seleccionar una respuesta para cada pregunta.';
			return;
		}

		isSaving = true;

		try {
			// Create a FormData from the form
			const form = event.target as HTMLFormElement;
			const formData = new FormData(form);

			// Asegurar que se incluyan todas las preguntas de todas las secciones
			Object.entries(sectionQuestions).forEach(([sectionCode, questions]) => {
				questions.forEach((question) => {
					// El índice local es la posición relativa dentro de la sección
					const localIndex = getSectionQuestionIndex(question.order_in_eval, sectionCode);

					const questionId = `question_${sectionCode}_${localIndex}`;
					const omitableId = `omitable_${sectionCode}_${localIndex}`;
					const scoreId = `score_${sectionCode}_${localIndex}`;

					if (!formData.has(questionId)) {
						formData.set(questionId, question.correct_key);
					}

					if (question.omitable && !formData.has(omitableId)) {
						formData.set(omitableId, 'on');
					}

					if (!formData.has(scoreId)) {
						formData.set(scoreId, question.score_percent.toString());
					}
				});
			});

			const response = await fetch('?/saveQuestions', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (result.type === 'success') {
				showToast('Claves guardadas exitosamente', 'success');
				// Redirigir a la lista de exámenes
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

	// Handle radio change
	function handleRadioChange(section: string, question: EvalQuestion, value: string) {
		const sectionArr = [...sectionQuestions[section]];
		const index = sectionArr.findIndex((q) => q.order_in_eval === question.order_in_eval);

		if (index !== -1) {
			sectionArr[index] = {
				...sectionArr[index],
				correct_key: value
			};

			sectionQuestions = {
				...sectionQuestions,
				[section]: sectionArr
			};
		}
	}

	// Handle toggle omitable
	function handleOmitableChange(section: string, question: EvalQuestion, checked: boolean) {
		const sectionArr = [...sectionQuestions[section]];
		const index = sectionArr.findIndex((q) => q.order_in_eval === question.order_in_eval);

		if (index !== -1) {
			sectionArr[index] = {
				...sectionArr[index],
				omitable: checked
			};

			sectionQuestions = {
				...sectionQuestions,
				[section]: sectionArr
			};
		}
	}

	// Handle score change
	function handleScoreChange(section: string, question: EvalQuestion, value: string) {
		const score = parseFloat(value);
		if (isNaN(score) || score < 0 || score > 1) return;

		const sectionArr = [...sectionQuestions[section]];
		const index = sectionArr.findIndex((q) => q.order_in_eval === question.order_in_eval);

		if (index !== -1) {
			sectionArr[index] = {
				...sectionArr[index],
				score_percent: score
			};

			sectionQuestions = {
				...sectionQuestions,
				[section]: sectionArr
			};
		}
	}
</script>

<PageTitle
	title={data.eval.name}
	description={`Asignar claves - ${data.eval.levels.name} - Grupo ${data.eval.group_name}`}
>
	<a href="/eval" class="btn btn-outline gap-1">
		<ArrowLeft size={18} />
		Volver
	</a>
</PageTitle>

<div class="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
	<div class="card bg-base-100 shadow-sm flex-1 w-full sm:w-auto">
		<div class="p-4 flex flex-col">
			<span class="text-sm text-base-content/70">Progreso Total</span>
			<div class="flex items-center justify-between mt-1 mb-2">
				<span class="font-semibold">{Math.round(completionPercentage)}%</span>
				<span class="text-xs">
					{Object.values(sectionQuestions)
						.flat()
						.filter((q) => q.correct_key !== '').length} /
					{Object.values(sectionQuestions).flat().length} preguntas
				</span>
			</div>
			<div class="relative h-2 w-full bg-base-200 rounded-full overflow-hidden">
				<div
					class="absolute top-0 left-0 h-full rounded-full transition-all duration-300 ease-out {completionPercentage ===
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
		class="btn btn-primary gap-2 w-full sm:w-auto {isValid ? 'btn-success' : ''}"
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

<div class="card bg-base-100 shadow-lg mx-auto">
	<div class="card-body p-6">
		<form id="keysForm" class="space-y-6" onsubmit={handleSubmit}>
			<!-- Tabs with completion indicators -->
			<div class="bg-base-200 rounded-lg overflow-hidden">
				<div class="tabs tabs-boxed bg-base-300/50 p-1 overflow-x-auto flex flex-nowrap">
					{#each data.sections as section, i (section.code)}
						{@const status = getSectionCompletionStatus(section.code)}
						{@const isComplete = status.completed === status.total}
						{@const sectionStart = sectionStarts[section.code] || 1}
						{@const sectionEnd = sectionStart + section.question_count - 1}
						<button
							type="button"
							class="tab tab-lifted whitespace-nowrap gap-2 {activeTab === i
								? 'tab-active'
								: ''} {isComplete ? 'text-success' : ''}"
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

			{#if message}
				<div class="mt-4">
					<Message description={message} type="warning" />
				</div>
			{/if}

			<!-- Questions for active section -->
			{#each data.sections as section, i (section.code)}
				{#if activeTab === i}
					<div class="space-y-6 p-2">
						<div
							class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
						>
							<h3 class="text-lg font-semibold text-primary">
								{section.course_name}
							</h3>
							<div class="text-sm bg-base-200 px-3 py-1 rounded-full">
								Seleccione la respuesta correcta para cada pregunta
							</div>
						</div>

						<div class="divide-y divide-base-300">
							{#each sectionQuestions[section.code] || [] as question (question.order_in_eval)}
								{@const localIndex = getSectionQuestionIndex(question.order_in_eval, section.code)}
								{@const questionId = `question_${section.code}_${localIndex}`}
								{@const omitableId = `omitable_${section.code}_${localIndex}`}
								{@const scoreId = `score_${section.code}_${localIndex}`}

								<div class="py-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
									<div class="md:col-span-1 flex items-center gap-2">
										<div class="flex flex-col items-center">
											<span class="text-lg font-semibold">{question.order_in_eval}</span>
											{#if localIndex !== question.order_in_eval}
												<span class="text-xs text-base-content/50">({localIndex})</span>
											{/if}
										</div>

										{#if question.correct_key}
											<div class="badge badge-success badge-sm ml-auto md:hidden">
												{question.correct_key}
											</div>
										{/if}
									</div>

									<div class="md:col-span-3 flex flex-wrap gap-4 justify-center md:justify-start">
										{#each options as option (option)}
											<label
												class="flex items-center gap-2 cursor-pointer hover:bg-base-200 transition-colors p-2 rounded-lg {question.correct_key ===
												option
													? 'bg-primary/10 border border-primary/30'
													: ''}"
											>
												<input
													type="radio"
													name={questionId}
													value={option}
													class="radio radio-primary"
													checked={question.correct_key === option}
													onchange={() => handleRadioChange(section.code, question, option)}
												/>
												<span class="font-medium text-lg">{option}</span>
											</label>
										{/each}
									</div>

									<div class="md:col-span-1 flex items-center justify-center">
										<label class="label cursor-pointer gap-2">
											<span class="label-text">Omitible</span>
											<input
												type="checkbox"
												name={omitableId}
												class="checkbox checkbox-sm checkbox-primary"
												checked={question.omitable}
												onchange={(e) =>
													handleOmitableChange(
														section.code,
														question,
														(e.target as HTMLInputElement).checked
													)}
											/>
										</label>
									</div>

									<div class="md:col-span-1 flex items-center justify-end gap-2">
										<span class="text-xs">Valor</span>
										<input
											type="number"
											name={scoreId}
											min="0"
											max="1"
											step="0.01"
											class="input input-sm input-bordered w-20"
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

			<!-- Navigation buttons -->
			<div class="pt-4 border-t border-base-300 flex justify-between">
				<button
					type="button"
					class="btn btn-outline btn-sm gap-2"
					disabled={activeTab === 0}
					onclick={() => (activeTab = Math.max(0, activeTab - 1))}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 19l-7-7 7-7"
						/>
					</svg>
					Anterior
				</button>

				<button
					type="button"
					class="btn btn-outline btn-sm gap-2"
					disabled={activeTab === data.sections.length - 1}
					onclick={() => (activeTab = Math.min(data.sections.length - 1, activeTab + 1))}
				>
					Siguiente
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	/* Smooth tab transitions */
	.tab {
		transition: all 0.2s ease;
	}
	.tab-active {
		transform: translateY(-2px);
	}

	/* Responsive improvements */
	@media (max-width: 640px) {
		.card-body {
			padding: 1rem;
		}
	}
</style>
