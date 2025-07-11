<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Table from '$lib/components/Table.svelte';
	import Message from '$lib/components/Message.svelte';
	import { Check, ListChecks, User, Calendar, School, Eye } from 'lucide-svelte';
	import { formatDate } from '$lib/utils/formatDate';
	import { goto } from '$app/navigation';
	import type { EvaluationResult, SectionScore, StudentQuestionAnswer } from '$lib/types';
	import type { TableColumn } from '$lib/types/table';

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

	// Utility functions
	function calculatePercentage(value: number, total: number): number {
		return total > 0 ? Math.round((value / total) * 100) : 0;
	}

	function getScoreColorClass(score: number): string {
		if (score >= 14) return 'text-success';
		if (score >= 10.5) return 'text-warning';
		return 'text-error';
	}

	function getBorderColor(score: number): string {
		if (score >= 14) return 'var(--success)';
		if (score >= 10.5) return 'var(--warning)';
		return 'var(--error)';
	}

	function storeNavigationState(key: string, state: Record<string, unknown>): void {
		try {
			sessionStorage.setItem(key, JSON.stringify({ ...state, timestamp: Date.now() }));
		} catch (e) {
			console.error('Error storing state in sessionStorage:', e);
		}
	}

	// Calculate percentages for radial progress
	const correctPercent = $derived(
		calculatePercentage(result.scores.general.correct_count, result.scores.general.total_questions)
	);
	const incorrectPercent = $derived(
		calculatePercentage(
			result.scores.general.incorrect_count,
			result.scores.general.total_questions
		)
	);
	const blankPercent = $derived(
		calculatePercentage(result.scores.general.blank_count, result.scores.general.total_questions)
	);
	const scorePercent = $derived(calculatePercentage(result.scores.general.score, 20));

	// Group answers by section
	type SectionGroup = {
		name: string;
		answers: StudentQuestionAnswer[];
	};

	function createSectionGroups(answers: StudentQuestionAnswer[]): Record<string, SectionGroup> {
		const groups: Record<string, SectionGroup> = {};

		if (!answers?.length) {
			console.warn('No answers available for this evaluation');
			return groups;
		}

		for (const answer of answers) {
			const sectionCode = answer.section_code || 'general';
			const sectionName = answer.section_name || 'General';

			if (!groups[sectionCode]) {
				groups[sectionCode] = { name: sectionName, answers: [] };
			}

			groups[sectionCode].answers.push(answer);
		}

		// Sort answers within each section by order_in_eval
		Object.values(groups).forEach((group) => {
			group.answers.sort((a, b) => a.order_in_eval - b.order_in_eval);
		});

		return groups;
	}

	const sectionGroups = $derived(createSectionGroups(result.answers));
	const sectionAnswers = $derived(
		Object.entries(sectionGroups).filter(([, section]) => section.answers.length > 0)
	);

	// Navigation functions
	function switchTab(tab: 'details' | 'answers'): void {
		activeTab = tab;
	}

	function goToResults(): void {
		if (data.fromPage === 'eval/student') {
			storeNavigationState('student_page_state', { studentCode: data.studentCode });
			goto(`/eval/student?student=${data.studentCode}`);
		} else {
			storeNavigationState('result_page_state', {
				levelCode: data.levelCode,
				evalCode: data.evalCode
			});
			goto(`/result?level=${data.levelCode}&eval=${data.evalCode}`);
		}
	}

	// Table column configurations
	const sectionScoreColumns: TableColumn<SectionScore>[] = [
		{ key: 'section_name', label: 'Sección', class: 'font-medium' },
		{ key: 'correct_count', label: 'Correctas', class: 'text-center text-success' },
		{ key: 'incorrect_count', label: 'Incorrectas', class: 'text-center text-error' },
		{ key: 'blank_count', label: 'Blanco', class: 'text-center text-warning' },
		{ key: 'total_questions', label: 'Total', class: 'text-center' },
		{ label: 'Nota', class: 'text-center font-bold', render: sectionScoreCell }
	];

	function getAnswerBadgeText(answer: StudentQuestionAnswer): string {
		if (answer.is_blank) return '-';
		if (answer.is_multiple) return 'Multi';
		return answer.student_answer || '-';
	}

	const answerColumns: TableColumn<StudentQuestionAnswer>[] = [
		{ key: 'order_in_eval', label: 'N°', class: 'w-12 text-center font-medium' },
		{ label: 'Respuesta', class: 'w-20 text-center', render: answerCell },
		{ label: 'Correcta', class: 'w-20 text-center', render: correctKeyCell },
		{ label: 'Estado', render: statusCell }
	];

	// Type for StatCard snippet parameters
	interface StatCardProps {
		title: string;
		value: string | number;
		percentage: number;
		colorClass: string;
		borderClass: string;
		borderColor?: string;
		subtitle: string;
	}
</script>

<!-- Define snippets for custom cells -->
{#snippet sectionScoreCell(row: SectionScore)}
	<span class={getScoreColorClass(row.score)}>
		{row.score.toFixed(2)}
	</span>
{/snippet}

{#snippet answerCell(row: StudentQuestionAnswer)}
	<span class="badge badge-lg font-mono">
		{getAnswerBadgeText(row)}
	</span>
{/snippet}

{#snippet correctKeyCell(row: StudentQuestionAnswer)}
	<span class="badge badge-outline badge-primary badge-lg font-mono">
		{row.correct_key}
	</span>
{/snippet}

{#snippet statusCell(row: StudentQuestionAnswer)}
	{#if row.is_blank}
		<span class="badge gap-1 badge-warning">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-alert-circle w-3 h-3"
				><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line
					x1="12"
					x2="12.01"
					y1="16"
					y2="16"
				/></svg
			>
			En blanco
		</span>
	{:else if row.is_correct}
		<span class="badge gap-1 badge-success">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-check w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg
			>
			Correcta
		</span>
	{:else if row.is_multiple}
		<span class="badge gap-1 badge-error">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-x w-3 h-3"
				><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg
			>
			Múltiple
		</span>
	{:else}
		<span class="badge gap-1 badge-error">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="lucide lucide-x w-3 h-3"
				><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg
			>
			Incorrecta
		</span>
	{/if}
{/snippet}

{#snippet StatCard({
	title,
	value,
	percentage,
	colorClass,
	borderClass,
	borderColor = '',
	subtitle
}: StatCardProps)}
	<div class="card bg-base-200 shadow">
		<div class="card-body p-4 items-center text-center">
			<h3 class="card-title {colorClass} mb-2">{title}</h3>
			<div class="flex items-center justify-center">
				<div
					class="radial-progress bg-base-100 {colorClass} {borderClass}"
					style="--value:{percentage}; {borderColor ? `border-color: ${borderColor};` : ''}"
					aria-valuenow={percentage}
					role="progressbar"
				>
					{value}
				</div>
			</div>
			<p class="text-xs mt-2">{subtitle}</p>
		</div>
	</div>
{/snippet}

<PageTitle
	title={`Detalle de Evaluación: ${result.eval.name}`}
	description={`Resultados de ${result.student.name} ${result.student.last_name}`}
>
	<button class="btn btn-outline btn-primary" onclick={goToResults}>
		{#if data.fromPage === 'eval/student'}
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
					{@render StatCard({
						title: 'Correctas',
						value: result.scores.general.correct_count,
						percentage: correctPercent,
						colorClass: 'text-success',
						borderClass: 'border-success',
						subtitle: `de ${result.scores.general.total_questions} preguntas`
					})}

					{@render StatCard({
						title: 'Incorrectas',
						value: result.scores.general.incorrect_count,
						percentage: incorrectPercent,
						colorClass: 'text-error',
						borderClass: 'border-error',
						subtitle: `de ${result.scores.general.total_questions} preguntas`
					})}

					{@render StatCard({
						title: 'En blanco',
						value: result.scores.general.blank_count,
						percentage: blankPercent,
						colorClass: 'text-warning',
						borderClass: 'border-warning',
						subtitle: `de ${result.scores.general.total_questions} preguntas`
					})}

					{@render StatCard({
						title: 'Nota General',
						value: result.scores.general.score.toFixed(1),
						percentage: scorePercent,
						colorClass: getScoreColorClass(result.scores.general.score),
						borderClass: 'border-4',
						borderColor: getBorderColor(result.scores.general.score),
						subtitle: 'de 20.00 puntos'
					})}
				</div>

				<!-- Puntajes por Sección -->
				{#if Object.keys(result.scores.by_section).length > 0}
					<div class="card bg-base-200 shadow mb-6">
						<div class="card-body">
							<h3 class="card-title text-primary mb-2">Puntajes por Sección</h3>
							<div class="overflow-x-auto">
								<Table
									columns={sectionScoreColumns}
									rows={Object.values(result.scores.by_section)}
									striped={true}
									hover={true}
									bordered={true}
									emptyMessage="No hay secciones para mostrar."
								/>
							</div>
						</div>
					</div>
				{/if}
			{:else if activeTab === 'answers'}
				{#if result.answers.length > 0}
					{#each sectionAnswers as [sectionCode, section] (sectionCode)}
						<div class="card bg-base-200 shadow mb-6">
							<div class="card-body">
								<h3 class="card-title text-primary mb-2">{section.name}</h3>
								<div class="overflow-x-auto">
									<Table
										columns={answerColumns}
										rows={section.answers}
										striped={true}
										hover={true}
										bordered={true}
										compact={true}
										emptyMessage="No hay respuestas para mostrar."
									/>
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
