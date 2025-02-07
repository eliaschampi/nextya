<script>
	import LogoHead from '$lib/components/LogoHead.svelte';
	import { Bird, ChartArea, FolderPen, House, Settings, UserRound } from 'lucide-svelte';

	let { children } = $props();
</script>

<div class="drawer lg:drawer-open">
	<input id="drawer-toggle" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex flex-col min-h-screen">
		<nav class="navbar bg-base-200 shadow-md px-4">
			<div class="flex-1">
				<a href="/" class="btn btn-ghost normal-case text-xl">Dashboard</a>
			</div>
			<!-- Navbar Icons -->
			<div class="flex items-center gap-2">
				<!-- Search Icon -->
				<a href="/" class="btn btn-ghost btn-circle" aria-label="search aria">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-4.35-4.35m1.72-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</a>
				<!-- Notification Icon -->
				<a href="/" class="btn btn-ghost btn-circle" aria-label="notification aria">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 17h5l-1.405-1.405C18.37 14.37 18 13.21 18 12V9a6 6 0 10-12 0v3c0 1.21-.37 2.37-1.595 3.195L3 17h5m7 0v1a3 3 0 11-6 0v-1m6 0H9"
						/>
					</svg>
				</a>
				<!-- Theme Toggle -->
				<label class="swap swap-rotate">
					<!-- this hidden checkbox controls the state -->
					<input type="checkbox" class="theme-controller" value="light" />

					<!-- sun icon -->
					<svg
						class="swap-off h-6 w-6 fill-current"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
					>
						<path
							d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
						/>
					</svg>

					<!-- moon icon -->
					<svg
						class="swap-on h-6 w-6 fill-current"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
					>
						<path
							d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"
						/>
					</svg>
				</label>
				<label for="drawer-toggle" class="btn btn-primary drawer-button lg:hidden"> ☰ </label>
			</div>
		</nav>
		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>

	<!-- Sidebar / Drawer -->
	<div class="drawer-side">
		<!-- Clicking this label closes the sidebar on mobile -->
		<label for="drawer-toggle" aria-label="Close sidebar" class="drawer-overlay"></label>
		<aside class="bg-base-200 text-base-content min-h-full w-80 flex flex-col">
			<LogoHead />
			<div class="p-4 flex-1 overflow-y-auto">
				<ul class="menu rounded-box w-full space-y-2">
					<li><a href="/"><House size="16" /> Inicio</a></li>
					<li class="menu-title">Administración</li>
					<li>
						<details>
							<summary><ChartArea size="16" /> Reportes</summary>
							<ul>
								<li><a href="/dashboard">Cursos</a></li>
								<li><a href="/student">Estudiantes</a></li>
							</ul>
						</details>
					</li>
					<li>
						<details>
							<summary><Bird size="16" /> Registros</summary>
							<ul>
								<li><a href="/">Escuelas</a></li>
								<li><a href="/">Grupos</a></li>
								<li><a href="/">Estudiantes</a></li>
							</ul>
						</details>
					</li>
					<li>
						<details>
							<summary><FolderPen size="16" /> Evaluaciones</summary>
							<ul>
								<li><a href="/">Reporte</a></li>
								<li><a href="/">Ajustes</a></li>
							</ul>
						</details>
					</li>
					<li class="menu-title">Sistema</li>
					<li><a href="/"><UserRound size="16" /> Usuarios</a></li>
					<li><a href="/"><Settings size="16" /> Configuración</a></li>
				</ul>
			</div>
			<div class="p-4">
				<a href="/" class="flex items-center p-2 hover:bg-base-300 rounded">
					<span class="mr-2 text-lg">🧑</span>
					<span>Elias Champi</span>
				</a>
			</div>
		</aside>
	</div>
</div>
