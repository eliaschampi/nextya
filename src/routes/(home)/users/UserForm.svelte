<!-- src/components/UserForm.svelte -->
<script lang="ts">
	import type { User } from '../../../app';

	type Props = {
		mode: 'create' | 'update';
		user?: User;
		onFinish: (message: string, success: boolean) => void;
	};

	let { mode, user, onFinish }: Props = $props();

	let formData = $state({
		user_id: '',
		name: '',
		lastname: '',
		email: '',
		password: '',
		is_active: true
	});

	$effect(() => {
		if (mode === 'update' && user) {
			formData = {
				user_id: user.user_id,
				name: user.name,
				lastname: user.last_name,
				email: user.email,
				password: '',
				is_active: user.is_active
			};
		}
	});

	let loading = $state(false);

	function resetForm() {
		formData = {
			user_id: '',
			name: '',
			lastname: '',
			email: '',
			password: '',
			is_active: true
		};
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		if (!formData.name.trim() || !formData.lastname.trim() || !formData.email.trim()) {
			onFinish('Todos los campos son obligatorios', false);
			return;
		}

		loading = true;
		const formElement = event.currentTarget as HTMLFormElement;
		const dataToSend = new FormData(formElement);
		if (mode === 'update') {
			dataToSend.append('user_id', formData.user_id);
		}

		const endpoint = mode === 'create' ? '?/create' : '?/update';
		const response = await fetch(endpoint, { method: 'POST', body: dataToSend });

		const res = await response.json();
		if (res.type === 'success') {
			onFinish(
				mode === 'create' ? 'Usuario creado exitosamente' : 'Usuario actualizado exitosamente',
				true
			);
			resetForm();
		} else {
			onFinish(res.error || 'Error en la operación', false);
		}

		loading = false;
	}
</script>

<form onsubmit={handleSubmit} method="post" autocomplete="off" class="modal-box">
	<h3 class="text-lg font-bold">
		{mode === 'create' ? 'Agregar un nuevo usuario' : 'Actualizar usuario'}
	</h3>

	<fieldset class="fieldset bg-base-200 border border-base-300 p-4 rounded-box">
		<legend class="fieldset-legend">Datos del usuario</legend>
		<label for="uname" class="w-full">Nombre</label>
		<input
			type="text"
			id="uname"
			name="name"
			placeholder="Nombre"
			class="input w-full validator"
			bind:value={formData.name}
			required
		/>
		<label for="ulastname" class="w-full">Apellidos</label>
		<input
			type="text"
			id="ulastname"
			name="last_name"
			placeholder="Apellidos"
			class="input w-full validator"
			bind:value={formData.lastname}
			required
		/>
	</fieldset>

	<fieldset class="fieldset bg-base-200 border border-base-300 p-4 rounded-box">
		<legend class="fieldset-legend">Datos de acceso</legend>
		<label for="uemail" class="w-full">Correo electrónico</label>
		<input
			type="email"
			id="uemail"
			name="email"
			placeholder="Correo electrónico"
			class="input w-full validator"
			bind:value={formData.email}
			required
		/>
		<label for="upassword" class="fieldset-label w-full">Contraseña</label>
		<input
			type="password"
			id="upassword"
			name="password"
			placeholder="Contraseña"
			disabled={mode === 'update'}
			minlength="8"
			class="input w-full validator"
			bind:value={formData.password}
			required
		/>
		<label class="fieldset-label w-full" for="ustatus">Estado</label>
		<input
			type="checkbox"
			name="is_active"
			bind:checked={formData.is_active}
			id="ustatus"
			class="toggle toggle-primary"
		/>
	</fieldset>

	<div class="text-center mt-4">
		<button type="submit" class="btn btn-primary" disabled={loading}>
			{loading ? 'Cargando...' : mode === 'create' ? 'Guardar' : 'Actualizar'}
		</button>
	</div>
</form>
<form method="dialog" class="modal-backdrop">
	<button onclick={() => resetForm()}>close</button>
</form>
