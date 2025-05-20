<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { showToast } from '$lib/stores/Toast';
	let { data, children } = $props();
	import '../style.css';
	import '$lib/styles/utils.css';
	import Toast from '$lib/components/Toast.svelte';

	let { session, supabase } = $derived(data);
	let sessionCheckInterval: number | undefined;

	// Función para verificar si la sesión ha expirado
	const checkSessionExpiration = () => {
		if (session) {
			const now = Math.floor(Date.now() / 1000);
			if (session.expires_at && session.expires_at < now) {
				// La sesión ha expirado, cerrar sesión y redirigir
				supabase.auth.signOut().then(() => {
					showToast('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'warning');
					goto('/auth');
				});
			}
		}
	};

	onMount(() => {
		// Escuchar cambios en la sesión
		const { data: subscriptionData } = supabase.auth.onAuthStateChange((event, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}

			// Si se cierra la sesión, redirigir a login
			if (event === 'SIGNED_OUT') {
				goto('/auth');
			}
		});

		// Verificar expiración de sesión cada minuto
		sessionCheckInterval = window.setInterval(checkSessionExpiration, 60000);

		return () => {
			subscriptionData.subscription.unsubscribe();
			if (sessionCheckInterval) {
				clearInterval(sessionCheckInterval);
			}
		};
	});

	onDestroy(() => {
		if (sessionCheckInterval) {
			clearInterval(sessionCheckInterval);
		}
	});
</script>

<Toast />

{@render children()}
