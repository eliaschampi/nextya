<script lang="ts">
	let { data } = $props();
</script>

<div class="card bg-base-200 w-96 shadow">
	<figure>
		<img
			src="/loginheader.svg"
			alt="Login"
		/>
	</figure>
	<div class="card-body">
		<fieldset class="fieldset w-xs bg-base-200 border border-base-300 p-4 rounded-box space-y-4">
			<legend class="fieldset-legend">Ingrese sus credenciales para iniciar sesión</legend>

			<div>
				<label class="fieldset-label" for="email">Correo</label>
				<input id="email" type="text" class="input" placeholder="Correo" />
			</div>

			<div>
				<label class="fieldset-label" for="password">Contraseña</label>
				<input id="password" type="password" class="input" placeholder="Contraseña" />
			</div>

			<div>
				<button class="btn btn-dash btn-secondary btn-block">Iniciar sesión</button>
			</div>
		</fieldset>
	</div>
</div>
