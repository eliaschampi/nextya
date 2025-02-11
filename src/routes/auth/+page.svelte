<script lang="ts">
	import LogoHead from '$lib/components/LogoHead.svelte';
</script>

<div class="card bg-base-200 w-96 shadow">
	<figure>
		<LogoHead />
	</figure>
	<form action="?/login" method="POST" class="card-body">
		<fieldset class="fieldset w-xs bg-base-200 border border-base-300 p-4 rounded-box space-y-4">
			<legend class="fieldset-legend">Ingrese sus credenciales para iniciar sesión</legend>

			<div>
				<label class="fieldset-label" for="email">Correo</label>
				<input id="email" name="email" type="text" class="input" placeholder="Correo" required/>
			</div>

			<div>
				<label class="fieldset-label" for="password">Contraseña</label>
				<input
					id="password"
					name="password"
					type="password"
					class="input"
					placeholder="Contraseña"
					required
				/>
			</div>

			<div>
				<button type="submit" class="btn btn-dash btn-secondary btn-block">Iniciar sesión</button>
			</div>
		</fieldset>
	</form>
</div>
