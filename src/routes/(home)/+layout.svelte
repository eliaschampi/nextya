<script lang="ts">
	import LogoHead from '$lib/components/LogoHead.svelte';
	import {
		Bird,
		ChartArea,
		ChevronDown,
		FileText,
		FolderPen,
		House,
		LogOut,
		Menu,
		Moon,
		Settings,
		Sun,
		UserCog,
		UserRound
	} from 'lucide-svelte';

	import { page } from '$app/state';
	import { getInitials } from '$lib/utils/initialName';
	import { theme } from '$lib/stores/theme';
	import Background from '$lib/components/background.svelte';
	import { initializePermissions } from '$lib/stores/permissions';

	initializePermissions(page.data.userPermissions || []);

	let { children } = $props();

	let isDarkTheme = $derived($theme === 'dark');

	interface userData {
		name?: string;
		last_name?: string;
		photo_url?: string;
	}

	let userData = $state<userData>({
		name: page.data.user?.name || '',
		last_name: page.data.user?.last_name || ''
	});

	function toggleTheme() {
		theme.toggle();
	}
</script>

<svelte:head>
	<title>
		{page.data?.title ? `${page.data.title} | Nextya` : 'Nextya'}
	</title>
</svelte:head>

<div class="drawer lg:drawer-open h-screen overflow-hidden bg-base-100">
	<input id="drawer-toggle" type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col h-screen">
		<!-- Modern Floating Navbar -->
		<nav
			class="navbar bg-base-300/80 backdrop-blur-md border-b border-base-300 px-6 h-16 sticky top-0 z-30"
		>
			<label for="drawer-toggle" class="drawer-button lg:hidden btn btn-ghost btn-sm btn-circle">
				<Menu class="w-5 h-5" />
			</label>
			<div class="flex-1 flex items-center gap-4">
				<a href="/" class="btn btn-ghost btn-sm hover:bg-primary/10" aria-label="home">
					<House class="w-5 h-5" />
				</a>
				<div class="text-lg font-semibold text-base-content/90">{page.data.title ?? 'Inicio'}</div>
			</div>

			<div class="flex items-center gap-3">
				<button
					class="btn btn-ghost btn-sm btn-circle hover:bg-primary/10 transition-colors"
					onclick={toggleTheme}
					aria-label="toggle theme"
				>
					{#if isDarkTheme}
						<Sun class="w-5 h-5" />
					{:else}
						<Moon class="w-5 h-5" />
					{/if}
				</button>

				{#if page.data.user}
					<div class="dropdown dropdown-end">
						<div
							tabindex="0"
							role="button"
							class="flex items-center gap-2 btn btn-ghost btn-sm px-3 hover:bg-primary/10 transition-colors"
						>
							<div class="avatar">
								<div
									class="w-7 rounded-full ring-2 ring-primary/20 ring-offset-2 ring-offset-base-100"
								>
									{#if userData.photo_url}
										<img
											src={`/${userData.photo_url}`}
											alt={`Avatar de ${userData.name} ${userData.last_name}`}
											class="rounded-full"
										/>
									{:else}
										<div
											class="flex items-center justify-center h-full bg-gradient-to-br from-primary to-primary/80 text-primary-content rounded-full"
										>
											<span class="text-xs font-bold">
												{getInitials(userData.name || '', userData.last_name || '')}
											</span>
										</div>
									{/if}
								</div>
							</div>
							<ChevronDown class="h-4 w-4 opacity-60" />
						</div>
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<ul
							tabindex="0"
							class="dropdown-content menu bg-base-100 border border-base-300 w-56 mt-3 p-3 z-50 backdrop-blur-md overflow-hidden"
						>
							<li class="menu-title pt-0 pb-3 border-b border-base-300/30">
								<span class="font-semibold text-base-content/90"
									>{userData.name} {userData.last_name}</span
								>
							</li>
							<li>
								<a href="/profile" class="flex gap-3 py-2.5 hover:bg-primary/10 rounded-lg">
									<UserCog class="h-4 w-4" />Mi perfil
								</a>
							</li>
							<li>
								<a href="/config" class="flex gap-3 py-2.5 hover:bg-primary/10 rounded-lg">
									<Bird class="h-4 w-4" />Sistema
								</a>
							</li>
							<li class="mt-2 pt-2 border-t border-base-300/30">
								<form action="/api/logout" method="POST">
									<button
										type="submit"
										class="w-full flex gap-3 py-2.5 text-error hover:bg-error/10 rounded-lg"
									>
										<LogOut class="h-4 w-4" />Cerrar sesión
									</button>
								</form>
							</li>
						</ul>
					</div>
				{/if}
			</div>
		</nav>

		<main class="flex-1 p-6 overflow-y-auto">
			<Background
				enableAnimation={true}
				enableInteraction={true}
				opacity={0.06}
				maxOpacity={0.2}
				gridSpacing={40}
				nodeSize={1.2}
				animationSpeed={0.0008}
				sigma={160}
			/>
			<div class="max-w-7xl mx-auto">
				{@render children()}
			</div>
		</main>
	</div>

	<div class="drawer-side z-40">
		<label for="drawer-toggle" aria-label="Close sidebar" class="drawer-overlay"></label>
		<!-- 4. Same backdrop & border as navbar -->
		<aside
			class="bg-base-300/80 backdrop-blur-md border-r border-base-300 text-base-content h-screen w-72 flex flex-col overflow-hidden"
		>
			<div class="p-6 border-b border-base-300/30">
				<div class="mx-auto">
					<LogoHead />
				</div>
			</div>

			<!-- Navigation -->
			<div class="flex-1 overflow-y-auto p-4 space-y-2">
				<!-- Quick Access -->
				<div class="mb-6">
					<a
						href="/"
						class="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-200 group"
					>
						<House class="h-5 w-5 group-hover:scale-110 transition-transform" />
						<span class="font-medium">Inicio</span>
					</a>
				</div>

				<!-- Dashboards Section -->
				<div class="space-y-2">
					<div class="px-4 py-2">
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
							Dashboards
						</h3>
					</div>

					<div class="space-y-1">
						<details class="group">
							<summary
								class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-100/50 cursor-pointer transition-all duration-200 group-open:bg-base-200/30"
							>
								<ChartArea class="h-5 w-5 text-base-content/70" />
								<span class="font-medium flex-1">Reportes</span>
								<ChevronDown
									class="h-4 w-4 text-base-content/50 transition-transform group-open:rotate-180"
								/>
							</summary>
							<div class="mt-2 ml-4 space-y-1">
								<a
									href="/dashboard"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>General</span>
								</a>
								<a
									href="/dashboard/ranking"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Ranking</span>
								</a>
								<a
									href="/dashboard/course"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Cursos</span>
								</a>
								<a
									href="/dashboard/student"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Estudiantes</span>
								</a>
								<a
									href="/dashboard/eval"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Evaluaciones</span>
								</a>
							</div>
						</details>
					</div>
				</div>

				<!-- Academic Section -->
				<div class="space-y-2">
					<div class="px-4 py-2">
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
							Académico
						</h3>
					</div>

					<div class="space-y-1">
						<!-- Estructura -->
						<details class="group">
							<summary
								class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-100/50 cursor-pointer transition-all duration-200 group-open:bg-base-200/30"
							>
								<Settings class="h-5 w-5 text-base-content/70" />
								<span class="font-medium flex-1">Estructura</span>
								<ChevronDown
									class="h-4 w-4 text-base-content/50 transition-transform group-open:rotate-180"
								/>
							</summary>
							<div class="mt-2 ml-4 space-y-1">
								<a
									href="/levels"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Niveles</span>
								</a>
								<a
									href="/courses"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Cursos</span>
								</a>
							</div>
						</details>

						<!-- Estudiantes -->
						<details class="group">
							<summary
								class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-100/50 cursor-pointer transition-all duration-200 group-open:bg-base-200/30"
							>
								<UserRound class="h-5 w-5 text-base-content/70" />
								<span class="font-medium flex-1">Estudiantes</span>
								<ChevronDown
									class="h-4 w-4 text-base-content/50 transition-transform group-open:rotate-180"
								/>
							</summary>
							<div class="mt-2 ml-4 space-y-1">
								<a
									href="/student"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Gestionar</span>
								</a>
								<a
									href="/impcsv"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Importar</span>
								</a>
								<a
									href="/eval/student"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Resultados</span>
								</a>
							</div>
						</details>

						<!-- Evaluaciones -->
						<details class="group">
							<summary
								class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-100/50 cursor-pointer transition-all duration-200 group-open:bg-base-200/30"
							>
								<FolderPen class="h-5 w-5 text-base-content/70" />
								<span class="font-medium flex-1">Evaluaciones</span>
								<ChevronDown
									class="h-4 w-4 text-base-content/50 transition-transform group-open:rotate-180"
								/>
							</summary>
							<div class="mt-2 ml-4 space-y-1">
								<a
									href="/eval"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Registrar</span>
								</a>
								<a
									href="/eval/check"
									class="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-primary/10 text-base-content/80 hover:text-primary transition-colors"
								>
									<div class="w-2 h-2 rounded-full bg-current opacity-50"></div>
									<span>Procesar</span>
								</a>
							</div>
						</details>

						<!-- Resultados -->
						<a
							href="/result"
							class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-100/50 text-base-content/80 hover:text-primary transition-all duration-200 group"
						>
							<FileText class="h-5 w-5 group-hover:scale-110 transition-transform" />
							<span class="font-medium">Resultados</span>
						</a>
					</div>
				</div>

				<!-- Administration Section -->
				<div class="space-y-2">
					<div class="px-4 py-2">
						<h3 class="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
							Administración
						</h3>
					</div>

					<div class="space-y-1">
						<a
							href="/users"
							class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-100/50 text-base-content/80 hover:text-primary transition-all duration-200 group"
						>
							<UserCog class="h-5 w-5 group-hover:scale-110 transition-transform" />
							<span class="font-medium">Usuarios</span>
						</a>
					</div>
				</div>
			</div>

			{#if page.data.user}
				<div class="border-t border-base-300/30 p-4 lg:hidden">
					<div class="flex items-center gap-4 px-4 py-3 rounded-xl bg-base-200/30">
						<div class="avatar">
							<div
								class="w-10 rounded-full ring-2 ring-primary/20 ring-offset-2 ring-offset-base-100"
							>
								{#if userData.photo_url}
									<img
										src={`/${userData.photo_url}`}
										alt={`Avatar de ${userData.name} ${userData.last_name}`}
										class="rounded-full"
									/>
								{:else}
									<div
										class="flex items-center justify-center h-full bg-gradient-to-br from-primary to-primary/80 text-primary-content rounded-full"
									>
										<span class="font-bold text-sm">
											{getInitials(userData.name || '', userData.last_name || '')}
										</span>
									</div>
								{/if}
							</div>
						</div>
						<div class="flex-1 min-w-0">
							<a href="/profile" class="block">
								<p class="font-semibold text-base-content truncate">
									{userData.name}
									{userData.last_name}
								</p>
								<p class="text-sm text-base-content/60 flex items-center">
									<span class="w-2 h-2 bg-success rounded-full mr-2"></span>
									<span>En línea</span>
								</p>
							</a>
						</div>
						<form action="/api/logout" method="POST">
							<button
								type="submit"
								class="btn btn-ghost btn-sm btn-circle hover:bg-error/10 hover:text-error transition-colors"
								aria-label="logout"
							>
								<LogOut class="h-4 w-4" />
							</button>
						</form>
					</div>
				</div>
			{/if}
		</aside>
	</div>
</div>
