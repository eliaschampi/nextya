<script lang="ts">
	import LogoHead from '$lib/components/LogoHead.svelte';
	import { KeyRound, Mail } from 'lucide-svelte';
	import { applyAction, enhance } from '$app/forms';
	import { showToast } from '$lib/stores/Toast';
	import { type ActionResult } from '@sveltejs/kit';

	let isLoading = $state(false);

	const handleEnhance = () => {
		isLoading = true;
		return async ({ result }: { result: ActionResult }) => {
			if (result.type === 'failure' && result.data?.error) {
				showToast(result.data.error, 'danger');
			} else if (result.type === 'redirect') {
				showToast('Inicio de sesión exitoso', 'success');
			}
			applyAction(result);
			isLoading = false;
		};
	};
</script>

<div class="card bg-base-200 w-96 shadow">
	<LogoHead />
	<form
		action="?/login"
		method="POST"
		use:enhance={handleEnhance}
		autocomplete="off"
		class="card-body flex flex-col pt-0 space-y-4"
	>
		<div>
			<label class="input validator" for="email">
				<Mail class="h-[1em] opacity-50" />
				<input type="email" id="email" name="email" placeholder="admin@nextya.com" required />
			</label>
			<div class="validator-hint hidden">Ingrese un correo válido</div>
		</div>
		<div>
			<label class="input validator" for="password">
				<KeyRound class="h-[1em] opacity-50" />
				<input
					type="password"
					name="password"
					required
					placeholder="Password"
					minlength="8"
					title="Contraseña"
				/>
			</label>
			<div class="validator-hint hidden">Ingrese una contraseña válida</div>
		</div>
		<div>
			<button type="submit" class="btn btn-dash btn-secondary btn-block" disabled={isLoading}>
				Iniciar sesión
			</button>
		</div>
	</form>
</div>
