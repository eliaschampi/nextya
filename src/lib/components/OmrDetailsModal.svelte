<script lang="ts">
	import { X, Check, AlertCircle } from 'lucide-svelte';
	import type { OmrProcessedResult } from '$lib/types/omrProcessing';
	import type { AnswerValue } from '$lib/omrProcessor';
	import Message from './Message.svelte';

	const {
		result,
		open = false,
		onClose = () => {}
	} = $props<{
		result: OmrProcessedResult;
		open?: boolean;
		onClose?: () => void;
	}>();

	let modal = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (open && modal) {
			modal.showModal();
		} else if (!open && modal) {
			modal.close();
		}
	});

	$effect(() => {
		const modalElement = modal;
		if (!modalElement) return;

		const handleClose = () => onClose();
		modalElement.addEventListener('close', handleClose);
		return () => modalElement.removeEventListener('close', handleClose);
	});

	function closeModal() {
		modal?.close();
	}

	function getAnswerStatusClass(answer: AnswerValue, correctKey: string): string {
		if (!answer) return 'badge-warning';
		if (answer === 'error_multiple') return 'badge-error';
		return answer.toUpperCase() === correctKey ? 'badge-success' : 'badge-error';
	}

	function getAnswerStatusIcon(answer: AnswerValue, correctKey: string) {
		if (!answer) return AlertCircle;
		if (answer === 'error_multiple') return X;
		return answer.toUpperCase() === correctKey ? Check : X;
	}

	function formatAnswer(answer: AnswerValue): string {
		if (!answer) return 'Sin respuesta';
		if (answer === 'error_multiple') return 'Múltiples marcas';
		return answer;
	}
</script>

<dialog bind:this={modal} class="modal">
	<div class="modal-box flex flex-col">
		<h3 class="font-bold text-lg mb-4">Detalles de Respuestas</h3>

		{#if result}
			<!-- Información del estudiante si existe -->
			{#if result.student}
				<div class="mb-4">
					<div class="text-lg font-medium">
						{result.student.name}
						{result.student.lastName}
					</div>
					<div class="text-sm opacity-70">
						Código: {result.student.rollCode}
					</div>
				</div>
			{:else}
				<Message
					type="warning"
					description={result.validationStatus?.message || 'Estudiante no encontrado'}
				/>
				<div class="my-2">
					<div class="text-sm opacity-70">
						Código detectado: {result.studentCode || result.detectedCode || 'N/A'}
					</div>
				</div>
			{/if}

			<!-- Estadísticas si hay resultados -->
			{#if result.results}
				<div class="stats shadow mb-4 w-full">
					<div class="stat">
						<div class="stat-title">Correctas</div>
						<div class="stat-value text-success">{result.results.correctCount}</div>
					</div>

					<div class="stat">
						<div class="stat-title">Incorrectas</div>
						<div class="stat-value text-error">{result.results.incorrectCount}</div>
					</div>

					<div class="stat">
						<div class="stat-title">En blanco</div>
						<div class="stat-value text-warning">{result.results.blankCount}</div>
					</div>

					<div class="stat">
						<div class="stat-title">Nota</div>
						<div
							class="stat-value {result.results.totalScore >= 7
								? 'text-success'
								: result.results.totalScore >= 4
									? 'text-warning'
									: 'text-error'}"
						>
							{result.results.totalScore.toFixed(2)}
						</div>
					</div>
				</div>
			{/if}

			<!-- Tabla de respuestas -->
			{#if result.answers && result.questions}
				<div class="max-h-[20rem] overflow-y-auto border border-base-300 rounded-lg">
					<table class="table table-zebra w-full">
						<thead class="sticky top-0 bg-base-200 z-10">
							<tr>
								<th class="w-16">N°</th>
								<th>Respuesta</th>
								<th>Correcta</th>
								<th>Estado</th>
							</tr>
						</thead>
						<tbody>
							{#each result.questions as question (question.code)}
								{@const answer = result.answers[question.order_in_eval]}
								{@const correctKey = question.correct_key}
								{@const StatusIcon = getAnswerStatusIcon(answer, correctKey)}

								<tr>
									<td class="font-medium">{question.order_in_eval}</td>
									<td>
										<span class="badge font-mono">
											{formatAnswer(answer)}
										</span>
									</td>
									<td>
										<span class="badge badge-outline badge-primary font-mono">
											{correctKey}
										</span>
									</td>
									<td>
										<span class="badge {getAnswerStatusClass(answer, correctKey)} gap-1">
											<StatusIcon size={12} />
											{!answer
												? 'En blanco'
												: answer === 'error_multiple'
													? 'Múltiple'
													: answer.toUpperCase() === correctKey
														? 'Correcta'
														: 'Incorrecta'}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{:else}
			<div class="alert alert-warning">
				<AlertCircle />
				<span>No hay datos disponibles</span>
			</div>
		{/if}

		<div class="modal-action">
			<button class="btn" onclick={closeModal}>Cerrar</button>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>cerrar</button>
	</form>
</dialog>
