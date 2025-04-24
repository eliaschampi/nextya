<script lang="ts">
	import PageTitle from '$lib/components/PageTitle.svelte';
	import StudentSearchModal from '$lib/components/StudentSearchModal.svelte';
	import { User } from 'lucide-svelte';
	import type { Student } from '$lib/types';
	import { goto } from '$app/navigation';

	// State
	let studentSearchModalOpen = $state(false);

	function openStudentSearchModal() {
		studentSearchModalOpen = true;
	}

	function handleSelectStudent(student: Student) {
		studentSearchModalOpen = false;
		goto(`/eval_student/${student.code}`);
	}
</script>

<PageTitle
	title="Historial de Resultados"
	description="Visualiza el historial de resultados de un estudiante."
>
	<button
		class="btn btn-outline btn-primary"
		onclick={openStudentSearchModal}
		aria-label="Buscar estudiante"
	>
		<User size={20} class="mr-2" />
		Buscar Estudiante
	</button>
</PageTitle>

<main class="container mx-auto p-4">
	<div class="flex justify-center items-center py-16">
		<div class="bg-base-100/50 rounded-lg border border-base-300/30 p-8 w-full max-w-md">
			<User size={64} class="text-primary/30 mx-auto mb-4" />
			<h3 class="text-lg font-bold mb-2 text-center">Selecciona un estudiante</h3>
			<p class="text-base-content/70 mb-4 text-center">
				Para ver el historial de resultados, primero debes seleccionar un estudiante.
			</p>
		</div>
	</div>
</main>

<StudentSearchModal
	open={studentSearchModalOpen}
	onClose={() => (studentSearchModalOpen = false)}
	onSelectStudent={handleSelectStudent}
/>
