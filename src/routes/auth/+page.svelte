  <!-- +page.svelte -->
  <script lang="ts">
	import LogoHead from '$lib/components/LogoHead.svelte';
	import { KeyRound, Mail } from 'lucide-svelte';
	import { applyAction, enhance } from '$app/forms';
	import { showToast } from '$lib/stores/Toast';
	import { type ActionResult } from '@sveltejs/kit';
	import { fade, fly } from 'svelte/transition';
	
	// Reactive state con la sintaxis de Svelte v5
	let isLoading = $state(false);
	let email = $state('');
	let password = $state('');
	
	// Mejora de rendimiento: Memorización de función de mejora
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
  
  <div 
	class="relative max-w-sm w-full mx-4"
	in:fade={{ duration: 300, delay: 150 }}
  >
	<div class="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-xl"></div>
	
	<div class="card bg-base-100/90 backdrop-blur-lg overflow-hidden border border-white/10 shadow-xl rounded-xl relative z-10">
	  <div class="absolute -top-20 -right-20 w-40 h-40 bg-purple-500/30 rounded-full blur-3xl"></div>
	  <div class="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/30 rounded-full blur-3xl"></div>
	  
	  <!-- Mantenemos LogoHead como en el código original -->
	  <LogoHead />
	  
	  <form
		action="?/login"
		method="POST"
		use:enhance={handleEnhance}
		autocomplete="off"
		class="card-body flex flex-col pt-0 space-y-2"
	  >
		<div in:fly={{ y: 10, duration: 400, delay: 400 }}>
		  <label class="input input-bordered flex items-center gap-3 bg-base-200/50 border-base-300 hover:border-primary/50 transition-all duration-300" for="email">
			<Mail class="h-5 w-5 text-primary/70" />
			<input 
			  type="email" 
			  id="email"
			  name="email" 
			  placeholder="admin@nextya.com" 
			  bind:value={email}
			  class="grow bg-transparent focus:outline-none w-full" 
			  required 
			/>
		  </label>
		  <div class="text-xs text-error mt-1 opacity-0 transition-all">Ingrese un correo válido</div>
		</div>
		
		<div in:fly={{ y: 10, duration: 400, delay: 500 }}>
		  <label class="input input-bordered flex items-center gap-3 bg-base-200/50 border-base-300 hover:border-primary/50 transition-all duration-300" for="password">
			<KeyRound class="h-5 w-5 text-primary/70" />
			<input
			  type="password"
			  id="password" 
			  name="password"
			  bind:value={password}
			  placeholder="Password"
			  minlength="8"
			  title="Contraseña"
			  class="grow bg-transparent focus:outline-none w-full"
			  required
			/>
		  </label>
		  <div class="text-xs text-error mt-1 opacity-0 transition-all">Ingrese una contraseña válida</div>
		</div>
		
		<div in:fly={{ y: 10, duration: 400, delay: 600 }}>
		  <button 
			type="submit" 
			class="btn btn-primary w-full relative overflow-hidden group transition-all duration-300 shadow-lg hover:shadow-primary/20"
			disabled={isLoading}
		  >
			<span class="absolute inset-0 w-full h-full bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
			<span class="relative flex items-center justify-center gap-2">
			  {#if isLoading}
				<span class="loading loading-spinner loading-sm"></span>
			  {/if}
			  Iniciar sesión
			</span>
		  </button>
		</div>
		
		<div class="text-center text-xs text-base-content/70" in:fade={{ delay: 700 }}>
		  <a href="/recuperar" class="hover:text-primary transition-colors">¿Olvidaste tu contraseña?</a>
		</div>
	  </form>
	</div>
  </div>