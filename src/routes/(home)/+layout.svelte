<script lang="ts">
	import LogoHead from '$lib/components/LogoHead.svelte';
	import {
		Bell,
		Bird,
		ChartArea,
		ChevronsUpDown,
		FolderPen,
		House,
		LogOut,
		Menu,
		MessageCircleQuestion,
		Moon,
		Search,
		Settings,
		Sun,
		UserCog,
		UserRound
	} from 'lucide-svelte';

	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { Profile } from '../../app';
	import { getInitials } from '$lib/utils/initialName';
	let profile: Profile | null = $state(null);
	let { children } = $props();
	let modal: HTMLDialogElement | null = null;

	function openModal() {
		modal?.showModal();
	}

	async function fetchProfile() {
		const res = await fetch('/api/profile');
		const data = await res.json();
		profile = data.profile[0];
	}

	onMount(() => {
		fetchProfile();
	});
</script>

<svelte:head>
	<title>
		{page.data?.title ? `${page.data.title} | Nextya` : 'Nextya'}
	</title>
</svelte:head>

<div class="drawer lg:drawer-open">
	<input id="drawer-toggle" type="checkbox" class="drawer-toggle" />
	<div class="drawer-content flex flex-col min-h-screen">
		<nav class="navbar bg-base-200 shadow px-4">
			<label for="drawer-toggle" class="drawer-button lg:hidden">
				<Menu class="w-5 h-5" />
			</label>
			<div class="flex-1 flex items-center">
				<a href="/" class="btn btn-ghost" aria-label="home aria">
					<House class="w-5 h-5" />
				</a>
				<div class="text-lg">{page.data.title ?? 'Inicio'}</div>
			</div>
			<!-- Navbar Icons -->
			<div class="flex items-center gap-1">
				<!-- Search Icon a is not clickable -->
				<button class="btn btn-ghost btn-circle" aria-label="search aria" onclick={openModal}>
					<Search class="w-5 h-5" />
				</button>
				<!-- Notification Icon -->
				<a href="/" class="btn btn-ghost btn-circle" aria-label="notification aria">
					<Bell class="w-5 h-5" />
				</a>
				<!-- Theme Toggle -->
				<label class="swap swap-rotate ml-1">
					<input type="checkbox" class="theme-controller" value="light" />
					<Sun class="swap-off h-5 w-5" />
					<Moon class="swap-on h-5 w-5" />
				</label>

				<dialog bind:this={modal} class="modal">
					<div class="modal-box">
						<h3 class="text-lg font-bold">Hello!</h3>
						<p class="py-4">Este es mi dialog</p>
					</div>
					<form method="dialog" class="modal-backdrop">
						<button>close</button>
					</form>
				</dialog>
			</div>
		</nav>
		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>

	<div class="drawer-side shadow">
		<!-- Clicking this label closes the sidebar on mobile -->
		<label for="drawer-toggle" aria-label="Close sidebar" class="drawer-overlay"></label>
		<aside class="bg-base-200 text-base-content min-h-full w-80 flex flex-col">
			<LogoHead />
			<div class="p-4 flex-1 overflow-y-auto">
				<ul class="menu rounded-box w-full space-y-2">
					<li><a href="/"><House class="h-4 w-4" /> Inicio</a></li>
					<li class="menu-title">Administración</li>
					<li>
						<details>
							<summary><ChartArea class="h-4 w-4" /> Reportes</summary>
							<ul>
								<li><a href="/dashboard">Cursos</a></li>
								<li><a href="/student">Estudiantes</a></li>
							</ul>
						</details>
					</li>
					<li>
						<details>
							<summary><Bird class="h-4 w-4" /> Registros</summary>
							<ul>
								<li><a href="/">Escuelas</a></li>
								<li><a href="/">Grupos</a></li>
								<li><a href="/">Estudiantes</a></li>
							</ul>
						</details>
					</li>
					<li>
						<details>
							<summary><FolderPen class="h-4 w-4" /> Evaluaciones</summary>
							<ul>
								<li><a href="/">Reporte</a></li>
								<li><a href="/">Ajustes</a></li>
							</ul>
						</details>
					</li>
					<li class="menu-title">Sistema</li>
					<li><a href="/users"><UserRound class="h-4 w-4" /> Usuarios</a></li>
					<li><a href="/"><Settings class="h-4 w-4" /> Configuración</a></li>
				</ul>
			</div>
			<div class="dropdown dropdown-top dropdown-end w-full p-4">
				<div
					tabindex="0"
					role="button"
					class="bg-base-100 hover:bg-base-300 rounded-box mx-2 mt-0 flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-all"
				>
					{#if profile}
						<div class="avatar">
							<div
								class="w-8 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 bg-base-200"
							>
								{#if profile.photo_url}
									<div class="bg-base-200 mask mask-squircle w-8">
										<img
											src={profile.photo_url}
											alt={`Avatar de ${profile.name} ${profile.last_name}`}
										/>
									</div>
								{:else}
									<div
										class="flex items-center justify-center h-full bg-primary text-primary-content"
									>
										<span class="font-semibold">
											{getInitials(profile.name || '', profile.last_name || '')}
										</span>
									</div>
								{/if}
							</div>
						</div>
						<div class="grow -space-y-0.5">
							<p class="text-sm font-medium">{profile.name} {profile.last_name}</p>
							<p class="text-sm">🟢 En linea</p>
						</div>
						<ChevronsUpDown class="h-4 w-4" />
					{/if}
				</div>
				<ul
					role="menu"
					tabindex="0"
					class="dropdown-content menu bg-base-100 rounded-box shadow-base-content/4 mb-1 w-48 p-1 shadow-[0px_-10px_40px_0px]"
				>
					<li>
						<div><UserCog class="h-4 w-4" /><span>Mi perfil</span></div>
					</li>
					<li>
						<div><Settings class="h-4 w-4" /><span>Configuración</span></div>
					</li>
					<li>
						<div><MessageCircleQuestion class="h-4 w-4" /><span>Ayuda</span></div>
					</li>
					<li>
						<form action="/logout" method="POST">
							<LogOut class="h-4 w-4" />
							<button type="submit" class="text-left">Cerrar sesión</button>
						</form>
					</li>
				</ul>
			</div>
		</aside>
	</div>
</div>
