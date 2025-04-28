<script lang="ts">
	import { page } from '$app/state';
	import { getInitials } from '$lib/utils/initialName';
	import { UserRound, Calendar, ShieldCheck, Activity, LogIn, BadgeCheck } from 'lucide-svelte';

	// User data
	let userMetadata = $derived(page.data.user?.user_metadata || {});
	let userEmail = $derived(page.data.user?.email || '');
	let createdAt = $derived(
		page.data.user?.created_at
			? new Date(page.data.user.created_at).toLocaleDateString('es-ES', {
					day: '2-digit',
					month: 'long',
					year: 'numeric'
				})
			: ''
	);

	const loginHistory = $state([
		{
			date: new Date(page.data.user?.last_sign_in_at || '').toLocaleString('es-ES'),
			ip: '192.168.1.1',
			device: 'Chrome en Windows',
			status: 'success'
		}
	]);

	// Tabs
	let activeTab = $state(0);
	const tabs = [
		{ name: 'Actividades', icon: Activity },
		{ name: 'Dispositivos', icon: LogIn }
	];
</script>

<div class="container mx-auto max-w-4xl px-4">
	<!-- Profile Card Mejorado -->
	<div class="card bg-base-200 shadow border border-base-300/30 overflow-hidden mb-8">
		<div class="card-body p-0">
			<!-- Cabecera con gradiente -->
			<div
				class="relative h-32 sm:h-40 bg-gradient-to-r from-primary/30 to-secondary/30 flex items-center justify-center"
			>
				<div class="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
					<div class="avatar">
						<div
							class="w-32 h-32 rounded-full ring-4 ring-base-200 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center"
						>
							{#if userMetadata.photo_url}
								<img src={userMetadata.photo_url} alt="Foto de perfil" class="mask mask-circle" />
							{:else}
								<span class="text-4xl font-bold text-primary">
									{getInitials(userMetadata.name || '', userMetadata.last_name || '')}
								</span>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Información del usuario -->
			<div class="text-center mt-20 px-6 pb-6 space-y-3">
				<div>
					<h2 class="text-2xl font-bold">
						{userMetadata.name || ''}
						{userMetadata.last_name || ''}
					</h2>
					<div class="flex items-center justify-center gap-1 text-success mt-1">
						<span class="w-1.5 h-1.5 bg-success rounded-full"></span>
						<span>En línea</span>
					</div>
				</div>

				<p class="text-base-content/70 text-sm max-w-md mx-auto">
					{userEmail}
				</p>

				<!-- Estadísticas -->
				<div class="stats stats-vertical lg:stats-horizontal shadow bg-base-100 w-full">
					<div class="stat">
						<div class="stat-figure text-primary opacity-80">
							<UserRound class="w-5 h-5" />
						</div>
						<div class="stat-title">Rol</div>
						<div class="stat-value text-sm font-medium">
							{userMetadata.role === 'admin' ? 'Administrador' : 'Usuario'}
						</div>
					</div>

					<div class="stat">
						<div class="stat-figure text-primary opacity-80">
							<Calendar class="w-5 h-5" />
						</div>
						<div class="stat-title">Registro</div>
						<div class="stat-value text-sm font-medium">{createdAt}</div>
					</div>

					<div class="stat">
						<div class="stat-figure text-primary opacity-80">
							<BadgeCheck class="w-5 h-5" />
						</div>
						<div class="stat-title">Estado</div>
						<div class="stat-value text-sm font-medium text-success">Activo</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Tabs -->
	<div class="card bg-base-100 shadow border border-base-300/30">
		<div class="card-body p-0">
			<!-- Tab Headers -->
			<div class="tabs tabs-boxed bg-base-200 p-1 rounded-t-box">
				{#each tabs as tab, i (tab.name)}
					<button
						class="tab flex-1 gap-2 {activeTab === i ? 'tab-active bg-primary/10 font-medium' : ''}"
						onclick={() => (activeTab = i)}
					>
						{#if tab.icon === Activity}
							<Activity class="w-4 h-4" />
						{:else if tab.icon === LogIn}
							<LogIn class="w-4 h-4" />
						{/if}
						{tab.name}
					</button>
				{/each}
			</div>

			<!-- Tab Content -->
			<div class="p-4">
				{#if activeTab === 0}
					<!-- Activities Tab -->
					<div class="flex flex-col items-center justify-center py-8 px-4 text-center">
						<div class="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mb-3">
							<Activity class="w-8 h-8 opacity-40" />
						</div>
						<h3 class="text-lg font-medium">No hay actividades recientes</h3>
						<p class="text-base-content/60 max-w-md mt-2">
							Aquí aparecerán tus actividades recientes como cambios en tu cuenta o acciones en el
							sistema.
						</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th class="bg-base-200/80">Fecha y Hora</th>
									<th class="bg-base-200/80">IP</th>
									<th class="bg-base-200/80">Dispositivo</th>
									<th class="bg-base-200/80">Estado</th>
								</tr>
							</thead>
							<tbody>
								{#each loginHistory as login (login.date)}
									<tr class="hover">
										<td class="font-medium">{login.date}</td>
										<td>{login.ip}</td>
										<td>{login.device}</td>
										<td>
											{#if login.status === 'success'}
												<div class="badge badge-success badge-sm gap-1">
													<ShieldCheck class="w-3 h-3" />
													Éxito
												</div>
											{:else}
												<div class="badge badge-error badge-sm">Fallido</div>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
