<script lang="ts">
	import { page } from '$app/state';
	import { getInitials } from '$lib/utils/initialName';
	import { UserRound, Mail, Calendar, Clock, ShieldCheck, Activity, LogIn } from 'lucide-svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';

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

	// Login history (mock data - replace with real data)
	const loginHistory = $state([
		{
			date: new Date(Date.now() - 3600000).toLocaleString('es-ES'),
			ip: '192.168.1.1',
			device: 'Chrome en Windows',
			status: 'success'
		},
		{
			date: new Date(Date.now() - 86400000).toLocaleString('es-ES'),
			ip: '192.168.1.1',
			device: 'Firefox en MacOS',
			status: 'success'
		},
		{
			date: new Date(Date.now() - 172800000).toLocaleString('es-ES'),
			ip: '192.168.1.100',
			device: 'Safari en iPhone',
			status: 'success'
		}
	]);

	// Tabs
	let activeTab = $state(0);
	const tabs = [
		{ name: 'Actividades', icon: Activity },
		{ name: 'Inicios de Sesión', icon: LogIn }
	];
</script>

<PageTitle title="Mi Perfil" description="Administra tu información personal y revisa tu actividad">
	<span>Mi Perfil</span>
</PageTitle>

<div class="container mx-auto max-w-4xl px-4">
	<!-- Profile Card -->
	<div class="card bg-base-200 shadow-md border border-base-300/30 overflow-hidden mb-8">
		<div class="card-body p-6">
			<div class="flex flex-col md:flex-row gap-6 items-start">
				<!-- Avatar -->
				<div class="avatar">
					<div
						class="w-20 h-20 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-base-100 bg-gradient-to-r from-primary/20 to-secondary/20 flex items-center justify-center"
					>
						{#if userMetadata.photo_url}
							<img src={userMetadata.photo_url} alt="Foto de perfil" class="mask mask-circle" />
						{:else}
							<span class="text-2xl font-bold text-primary">
								{getInitials(userMetadata.name || '', userMetadata.last_name || '')}
							</span>
						{/if}
					</div>
				</div>

				<!-- User Information -->
				<div class="flex-1 space-y-4">
					<div>
						<h2 class="text-2xl font-bold">
							{userMetadata.name || ''}
							{userMetadata.last_name || ''}
						</h2>
						<div class="badge badge-primary badge-outline mt-1">Usuario</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="flex items-center gap-2 text-base-content/80">
							<UserRound class="w-4 h-4 opacity-60" />
							<span>ID: {page.data.user?.id.substring(0, 8)}...</span>
						</div>
						<div class="flex items-center gap-2 text-base-content/80">
							<Mail class="w-4 h-4 opacity-60" />
							<span>{userEmail}</span>
						</div>
						<div class="flex items-center gap-2 text-base-content/80">
							<Calendar class="w-4 h-4 opacity-60" />
							<span>Cuenta creada: {createdAt}</span>
						</div>
						<div class="flex items-center gap-2 text-base-content/80">
							<Clock class="w-4 h-4 opacity-60" />
							<span>Último acceso: {new Date().toLocaleString('es-ES')}</span>
						</div>
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
						<Activity class="w-12 h-12 opacity-20 mb-3" />
						<h3 class="text-lg font-medium">No hay actividades recientes</h3>
						<p class="text-base-content/60 max-w-md">
							Aquí aparecerán tus actividades recientes como cambios en tu cuenta o acciones en el
							sistema.
						</p>
					</div>
				{:else}
					<!-- Login History Tab -->
					<div class="overflow-x-auto">
						<table class="table table-zebra">
							<thead>
								<tr>
									<th class="w-1/3">Fecha y Hora</th>
									<th class="w-1/5">IP</th>
									<th class="w-1/3">Dispositivo</th>
									<th class="w-1/7">Estado</th>
								</tr>
							</thead>
							<tbody>
								{#each loginHistory as login (login.date)}
									<tr>
										<td>{login.date}</td>
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
