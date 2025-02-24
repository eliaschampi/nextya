<!-- src/components/UserList.svelte -->
<script lang="ts">
	import type { User } from '../../../app';

	// Definimos la prop `data` con el tipo adecuado
	export let data: { users: User[] };

	// Función para obtener las iniciales del nombre y apellido
	function getInitials(name: string, last_name: string): string {
		return `${name[0]}${last_name[0]}`.toUpperCase();
	}

	// Función para formatear fechas de manera legible
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('es-ES', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
	{#each data.users as user (user.user_id)}
		<div class="card w-full bg-base-200 shadow">
			<div class="card-body p-6">
				<!-- Avatar y detalles principales -->
				<div class="flex items-center space-x-4">
					<div class="avatar">
						<div
							class="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 bg-base-200"
						>
							{#if user.photo_url}
								<img
									src={user.photo_url}
									alt={`Avatar de ${user.name} ${user.last_name}`}
									class="object-cover w-full h-full"
								/>
							{:else}
								<div
									class="flex items-center justify-center h-full bg-primary text-primary-content"
								>
									<span class="text-2xl font-semibold">
										{getInitials(user.name, user.last_name)}
									</span>
								</div>
							{/if}
						</div>
					</div>
					<div class="flex-1">
						<h2 class="card-title text-2xl font-bold text-base-content">
							{user.name}
							{user.last_name}
						</h2>
						<p class="text-sm">{user.email}</p>
						{#if user.phone}
							<p class="text-sm">Teléfono: {user.phone}</p>
						{/if}
					</div>
				</div>

				<!-- Badges para rol y estado -->
				<div class="mt-4 flex gap-2">
					<span class="badge badge-secondary badge-md font-medium px-3 py-1">
						{user.role}
					</span>
					<span
						class="badge badge-md font-medium px-3 py-1 {user.is_active
							? 'badge-success'
							: 'badge-error'}"
					>
						{user.is_active ? 'Activo' : 'Inactivo'}
					</span>
				</div>

				<!-- Fechas de registro y último inicio -->
				<div class="mt-4 text-sm">
					<p>Registrado: {formatDate(user.created_at)}</p>
					<p>Último inicio: {formatDate(user.last_sign_in_at)}</p>
				</div>

				<!-- Botón de acción -->
				<div class="card-actions justify-end mt-4">
					<button class="btn btn-primary btn-sm">Ver Perfil</button>
				</div>
			</div>
		</div>
	{/each}
</div>
