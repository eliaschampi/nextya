<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import { Check, X, AlertCircle, ListChecks, User, Calendar, School, Eye } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/formatDate';
	import { goto } from '$app/navigation';

	import type { EvaluationResult } from '$lib/types';
	import Message from '$lib/components/Message.svelte';

	// Props from server
	const { data } = $props<{
		data: {
			result: EvaluationResult;
			title: string;
			fromPage: string;
			studentCode: string;
			evalCode: string;
			levelCode: string;
		};
	}>();

	// State
	let activeTab = $state<'details' | 'answers'>('details');

	// Computed values
	const result = data.result;

	// Calculate percentages for radial progress
	const correctPercent = $derived(
		Math.round(
			(result.scores.general.correct_count / result.scores.general.total_questions) * 100
		) || 0
	);
	const incorrectPercent = $derived(
		Math.round(
			(result.scores.general.incorrect_count / result.scores.general.total_questions) * 100
		) || 0
	);
	const blankPercent = $derived(
		Math.round((result.scores.general.blank_count / result.scores.general.total_questions) * 100) ||
			0
	);
	const scorePercent = $derived(Math.round((result.scores.general.score / 20) * 100) || 0);

	// Group answers by section
	type SectionGroup = {
		name: string;
		answers: Array<{
			question_code: string;
			student_answer: string | null;
			is_correct: boolean;
			is_blank?: boolean;
			is_multiple?: boolean;
			order_in_eval: number;
			correct_key: string;
			section_code: string | null;
			section_name?: string | null;
		}>;
	};

	const sectionGroups: Record<string, SectionGroup> = {};

	for (const answer of result.answers) {
		const sectionCode = answer.section_code || 'general';
		const sectionName = answer.section_name || 'General';

		if (!sectionGroups[sectionCode]) {
			sectionGroups[sectionCode] = {
				name: sectionName,
				answers: []
			};
		}

		sectionGroups[sectionCode].answers.push(answer);
	}

	const sectionAnswers = Object.entries(sectionGroups);

	function switchTab(tab: 'details' | 'answers') {
		activeTab = tab;
	}

	function getScoreColorClass(score: number): string {
		if (score >= 14) return 'text-success';
		if (score >= 10.5) return 'text-warning';
		return 'text-error';
	}

	function goToResults() {
		// Navigate back to the appropriate page based on fromPage parameter
		if (data.fromPage === 'eval_student') {
			// Store state in sessionStorage for better back navigation
			try {
				sessionStorage.setItem(
					'student_page_state',
					JSON.stringify({
						studentCode: data.studentCode,
						timestamp: Date.now()
					})
				);
			} catch (e) {
				console.error('Error storing state in sessionStorage:', e);
			}
			goto(`/eval_student?student=${data.studentCode}`);
		} else {
			// Default to result page
			// Store state in sessionStorage for better back navigation
			try {
				sessionStorage.setItem(
					'result_page_state',
					JSON.stringify({
						levelCode: data.levelCode,
						evalCode: data.evalCode,
						timestamp: Date.now()
					})
				);
			} catch (e) {
				console.error('Error storing state in sessionStorage:', e);
			}
			goto(`/result?level=${data.levelCode}&eval=${data.evalCode}`);
		}
	}
</script>

<PageTitle
	title={`Detalle de Evaluación: ${result.eval.name}`}
	description={`Resultados de ${result.student.name} ${result.student.last_name}`}
>
	<button class="btn btn-outline btn-primary" onclick={goToResults}>
		{#if data.fromPage === 'eval_student'}
			<User size={18} class="mr-2" />
			Volver a Historial del Estudiante
		{:else}
			<Eye size={18} class="mr-2" />
			Volver a Resultados
		{/if}
	</button>
</PageTitle>

<main class="container mx-auto p-4">
	<div class="card bg-base-200/80 shadow mb-6 border border-base-300/30">
		<div class="card-body">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
				<div>
					<h2 class="card-title text-primary flex items-center gap-2 mb-2">
						<User size={20} />
						Información del Estudiante
					</h2>
					<div class="p-3 rounded-lg">
						<div class="font-medium">{result.student.name} {result.student.last_name}</div>
						<div class="text-sm mt-1">
							<span class="font-medium">Código de registro:</span>
							{result.register.roll_code}
						</div>
						<div class="text-sm">
							<span class="font-medium">Grupo:</span>
							{result.register.group_name}
						</div>
					</div>
				</div>

				<div>
					<h2 class="card-title text-primary flex items-center gap-2 mb-2">
						<School size={20} />
						Información de la Evaluación
					</h2>
					<div class="p-3 rounded-lg">
						<div class="font-medium">{result.eval.name}</div>
						<div class="text-sm flex items-center gap-1 mt-1">
							<Calendar size={14} />
							{formatDate(result.eval.date)}
						</div>
						<div class="text-sm mt-1">
							<span class="font-medium">Nivel:</span>
							{result.eval.level_name}
						</div>
					</div>
				</div>
			</div>
			<div class="divider"></div>
			<!-- Tabs Navigation -->
			<div class="tabs tabs-box w-full">
				<button
					role="tab"
					class="tab {activeTab === 'details' ? 'tab-active' : ''}"
					onclick={() => switchTab('details')}
					tabindex={0}
				>
					<ListChecks size={16} class="mr-2" /> Resultados
				</button>
				<button
					role="tab"
					class="tab {activeTab === 'answers' ? 'tab-active' : ''}"
					onclick={() => switchTab('answers')}
					tabindex={0}
				>
					<Check size={16} class="mr-2" /> Respuestas
				</button>
			</div>

			<!-- Tab Content: Details -->
			{#if activeTab === 'details'}
				<!-- Estadísticas Generales -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<!-- Correctas -->
					<div class="card bg-base-200 shadow">
						<div class="card-body p-4 items-center text-center">
							<h3 class="card-title text-success mb-2">Correctas</h3>
							<div class="flex items-center justify-center">
								<div
									class="radial-progress bg-base-100 text-success border-success border-4"
									style="--value:{correctPercent};"
									aria-valuenow={correctPercent}
									role="progressbar"
								>
									{result.scores.general.correct_count}
								</div>
							</div>
							<p class="text-xs mt-2">de {result.scores.general.total_questions} preguntas</p>
						</div>
					</div>

					<!-- Incorrectas -->
					<div class="card bg-base-200 shadow">
						<div class="card-body p-4 items-center text-center">
							<h3 class="card-title text-error mb-2">Incorrectas</h3>
							<div class="flex items-center justify-center">
								<div
									class="radial-progress bg-base-100 text-error border-error border-4"
									style="--value:{incorrectPercent};"
									aria-valuenow={incorrectPercent}
									role="progressbar"
								>
									{result.scores.general.incorrect_count}
								</div>
							</div>
							<p class="text-xs mt-2">de {result.scores.general.total_questions} preguntas</p>
						</div>
					</div>

					<!-- En blanco -->
					<div class="card bg-base-200 shadow">
						<div class="card-body p-4 items-center text-center">
							<h3 class="card-title text-warning mb-2">En blanco</h3>
							<div class="flex items-center justify-center">
								<div
									class="radial-progress bg-base-100 text-warning border-warning border-4"
									style="--value:{blankPercent};"
									aria-valuenow={blankPercent}
									role="progressbar"
								>
									{result.scores.general.blank_count}
								</div>
							</div>
							<p class="text-xs mt-2">de {result.scores.general.total_questions} preguntas</p>
						</div>
					</div>

					<!-- Nota General -->
					<div class="card bg-base-200 shadow">
						<div class="card-body p-4 items-center text-center">
							<h3 class="card-title mb-2">Nota General</h3>
							<div class="flex items-center justify-center">
								<div
									class={`radial-progress bg-base-100 ${getScoreColorClass(result.scores.general.score)} border-4`}
									style={`--value:${scorePercent}; border-color: ${result.scores.general.score >= 14 ? 'var(--success)' : result.scores.general.score >= 10.5 ? 'var(--warning)' : 'var(--error)'};`}
									aria-valuenow={scorePercent}
									role="progressbar"
								>
									{result.scores.general.score.toFixed(1)}
								</div>
							</div>
							<p class="text-xs mt-2">de 20.00 puntos</p>
						</div>
					</div>
				</div>

				<!-- Puntajes por Sección -->
				{#if Object.keys(result.scores.by_section).length > 0}
					<div class="card bg-base-200 shadow mb-6">
						<div class="card-body">
							<h3 class="card-title text-primary mb-2">Puntajes por Sección</h3>
							<div class="overflow-x-auto">
								<table class="table table-zebra w-full">
									<thead>
										<tr class="bg-base-300/50">
											<th>Sección</th>
											<th class="text-center">Correctas</th>
											<th class="text-center">Incorrectas</th>
											<th class="text-center">Blanco</th>
											<th class="text-center">Total</th>
											<th class="text-center">Nota</th>
										</tr>
									</thead>
									<tbody>
										{#each Object.entries(result.scores.by_section) as [sectionCode, sectionScore] (sectionCode)}
											{@const typedScore = sectionScore as import('$lib/types').SectionScore}
											<tr>
												<td class="font-medium">{typedScore.section_name}</td>
												<td class="text-center text-success">{typedScore.correct_count}</td>
												<td class="text-center text-error">{typedScore.incorrect_count}</td>
												<td class="text-center text-warning">{typedScore.blank_count}</td>
												<td class="text-center">{typedScore.total_questions}</td>
												<td class="text-center font-bold {getScoreColorClass(typedScore.score)}">
													{typedScore.score.toFixed(1)}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				{/if}
			{:else if activeTab === 'answers'}
				{#if result.answers.length > 0}
					{#each sectionAnswers as [sectionCode, section] (sectionCode)}
						{@const typedSection = section as {
							name: string;
							answers: import('$lib/types').StudentQuestionAnswer[];
						}}
						<div class="card bg-base-200 shadow mb-6">
							<div class="card-body">
								<h3 class="card-title text-primary mb-2">{typedSection.name}</h3>
								<div class="overflow-x-auto">
									<table class="table table-zebra table-sm w-full">
										<thead>
											<tr class="bg-base-300/50">
												<th class="w-12 text-center">N°</th>
												<th class="w-20 text-center">Respuesta</th>
												<th class="w-20 text-center">Correcta</th>
												<th>Estado</th>
											</tr>
										</thead>
										<tbody>
											{#each typedSection.answers as answer (answer.question_code)}
												<tr>
													<td class="text-center font-medium">{answer.order_in_eval}</td>
													<td class="text-center">
														<span class="badge badge-lg font-mono">
															{answer.is_blank
																? '-'
																: answer.is_multiple
																	? 'Multi'
																	: answer.student_answer}
														</span>
													</td>
													<td class="text-center">
														<span class="badge badge-outline badge-primary badge-lg font-mono">
															{answer.correct_key}
														</span>
													</td>
													<td>
														<span
															class={`badge gap-1 ${
																answer.is_blank
																	? 'badge-warning'
																	: answer.is_multiple
																		? 'badge-error'
																		: answer.is_correct
																			? 'badge-success'
																			: 'badge-error'
															}`}
														>
															{#if answer.is_correct}
																<Check size={12} />
																Correcta
															{:else if answer.is_blank}
																<AlertCircle size={12} />
																En blanco
															{:else if answer.is_multiple}
																<X size={12} />
																Múltiple
															{:else}
																<X size={12} />
																Incorrecta
															{/if}
														</span>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					{/each}
				{:else}
					<Message type="info" description="No hay respuestas disponibles para este estudiante." />
				{/if}
			{/if}
		</div>
	</div>
</main>
