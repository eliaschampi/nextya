<script lang="ts">
	import { X, Check, AlertCircle, ListChecks, FileText, Table2 } from 'lucide-svelte';
	import type { ApiOmrSuccessData, StudentAnswer } from '$lib/types/api';
	import type { EvalQuestion } from '$lib/types';
	import Message from './Message.svelte';
	import { fade } from 'svelte/transition';

	type Props = {
		result: ApiOmrSuccessData | null;
		questions: EvalQuestion[]; // Pasar las preguntas para mapear nombres de sección, etc.
		open?: boolean;
		title?: string;
		onClose?: () => void;
	};

	const {
		result = null,
		open = false,
		title = 'Detalles del Resultado',
		onClose = () => {}
	}: Props = $props();

	let modal = $state<HTMLDialogElement | null>(null);
	let activeTab = $state<'details' | 'answers'>('details');

	$effect(() => {
		if (open && modal && !modal.open) {
			modal.showModal();
		} else if (!open && modal?.open) {
			modal.close();
		}
	});

	$effect(() => {
		const modalElement = modal;
		if (!modalElement) return;
		const handleClose = () => {
			if (open) onClose(); // Llama a onClose solo si el modal estaba supuesto a estar abierto
		};
		modalElement.addEventListener('close', handleClose);
		return () => modalElement.removeEventListener('close', handleClose);
	});

	function closeModal() {
		modal?.close();
	}

	function switchTab(tab: 'details' | 'answers') {
		activeTab = tab;
	}

	function getAnswerStatusClass(answer: StudentAnswer): string {
		if (answer.is_blank) return 'badge-warning';
		if (answer.is_multiple) return 'badge-error';
		return answer.is_correct ? 'badge-success' : 'badge-error';
	}

	function getAnswerStatusIcon(answer: StudentAnswer): typeof AlertCircle {
		if (answer.is_blank) return AlertCircle;
		if (answer.is_multiple) return X;
		return answer.is_correct ? Check : X;
	}

	function getAnswerStatusText(answer: StudentAnswer): string {
		if (answer.is_blank) return 'En blanco';
		if (answer.is_multiple) return 'Múltiple';
		return answer.is_correct ? 'Correcta' : 'Incorrecta';
	}

	function formatStudentAnswer(answerValue: StudentAnswer['student_answer']): string {
		if (answerValue === null) return '-';
		if (answerValue === 'error_multiple') return 'Multi';
		return answerValue;
	}

	function getScoreColorClass(score: number): string {
		if (score >= 14) return 'text-success';
		if (score >= 10.5) return 'text-warning'; // Punto medio de 0-20 es 10, aprobado > 10.5?
		return 'text-error';
	}
</script>

<dialog bind:this={modal} class="modal modal-bottom sm:modal-middle">
	{#if result}
		<div class="modal-box max-w-2xl" transition:fade>
			<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onclick={closeModal}>
				<X size={20} />
			</button>
			<h3 class="font-bold text-lg mb-1 flex items-center gap-2">
				<ListChecks />
				{title}
			</h3>
			<p class="text-sm opacity-70 mb-4">Código: {result.roll_code}</p>

			{#if result.student}
				<div class="mb-4 p-3 bg-base-200 rounded-lg">
					<div class="font-medium">{result.student.name} {result.student.last_name}</div>
				</div>
			{:else}
				<Message type="warning" description="Estudiante no encontrado en los registros." />
			{/if}

			<!-- Tabs Navigation -->
			<div class="tabs tabs-box mb-4">
				<button
					role="tab"
					class="tab w-full {activeTab === 'details' ? 'tab-active' : ''}"
					onclick={() => switchTab('details')}
					tabindex={0}
				>
					<FileText size={16} class="mr-2" /> Detalles del Curso
				</button>
				<button
					role="tab"
					class="tab w-full {activeTab === 'answers' ? 'tab-active' : ''}"
					onclick={() => switchTab('answers')}
					tabindex={0}
				>
					<Table2 size={16} class="mr-2" /> Tabla de Respuestas
				</button>
			</div>

			<!-- Tab Content: Details -->
			{#if activeTab === 'details'}
				<!-- Estadísticas Generales -->
				<div class="stats shadow mb-4 w-full bg-base-100">
					<div class="stat">
						<div class="stat-title">Correctas</div>
						<div class="stat-value text-success">{result.scores.general.correct_count}</div>
					</div>
					<div class="stat">
						<div class="stat-title">Incorrectas</div>
						<div class="stat-value text-error">{result.scores.general.incorrect_count}</div>
					</div>
					<div class="stat">
						<div class="stat-title">En blanco</div>
						<div class="stat-value text-warning">{result.scores.general.blank_count}</div>
					</div>
					<div class="stat">
						<div class="stat-title">Nota General</div>
						<div class={`stat-value ${getScoreColorClass(result.scores.general.score)}`}>
							{result.scores.general.score.toFixed(2)}
						</div>
						<div class="stat-desc">/ 20.00</div>
					</div>
				</div>

				<!-- Puntajes por Sección -->
				{#if Object.keys(result.scores.by_section).length > 0}
					<div class="font-medium">Puntajes por Sección</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
						<table class="min-w-full table table-sm">
							<thead>
								<tr>
									<th class="px-4 py-2">Sección</th>
									<th class="px-4 py-2 text-center">Correctas</th>
									<th class="px-4 py-2 text-center">Incorrectas</th>
									<th class="px-4 py-2 text-center">Blanco</th>
									<th class="px-4 py-2 text-center">Nota</th>
								</tr>
							</thead>
							<tbody>
								{#each Object.entries(result.scores.by_section) as [code, sectionScore] (code)}
									<tr class="border-t">
										<td class="px-4 py-2">{sectionScore.section_name}</td>
										<td class="px-4 py-2 text-center">{sectionScore.correct_count}</td>
										<td class="px-4 py-2 text-center">{sectionScore.incorrect_count}</td>
										<td class="px-4 py-2 text-center">{sectionScore.blank_count}</td>
										<td
											class="px-4 py-2 text-center font-bold {getScoreColorClass(
												sectionScore.score
											)}"
										>
											{sectionScore.score.toFixed(1)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{:else if activeTab === 'answers'}
				<!-- Tab Content: Answers Table -->
				<div class="max-h-[20rem] overflow-y-auto rounded-lg bg-base-200">
					<table class="table table-zebra table-pin-rows table-sm w-full">
						<thead>
							<tr>
								<th class="w-12 text-center">N°</th>
								<th class="w-20 text-center">Tu Resp.</th>
								<th class="w-20 text-center">Correcta</th>
								<th>Estado</th>
							</tr>
						</thead>
						<tbody>
							{#each result.answers as answer (answer.question_code)}
								{@const StatusIcon = getAnswerStatusIcon(answer)}
								<tr>
									<td class="text-center font-medium">{answer.order_in_eval}</td>
									<td class="text-center">
										<span class="badge badge-lg font-mono">
											{formatStudentAnswer(answer.student_answer)}
										</span>
									</td>
									<td class="text-center">
										<span class="badge badge-outline badge-primary badge-lg font-mono">
											{answer.correct_key}
										</span>
									</td>
									<td>
										<span class={`badge ${getAnswerStatusClass(answer)} gap-1`}>
											<StatusIcon size={12} />
											{getAnswerStatusText(answer)}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
	<form method="dialog" class="modal-backdrop"><button>cerrar</button></form>
</dialog>
