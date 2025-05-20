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
	function checkSessionExpiration() {
		if (!session) return;

		const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
		const now = Date.now();

		// Si ya expiró, cerrar sesión inmediatamente
		if (expiresAt > 0 && now >= expiresAt) {
			if (sessionCheckInterval) {
				clearInterval(sessionCheckInterval);
				sessionCheckInterval = undefined;
			}

			supabase.auth.signOut().then(() => {
				showToast('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'warning');
				goto('/auth');
			});
		}
	}

	// Configurar el intervalo de verificación de sesión
	function setupSessionCheck() {
		// Limpiar intervalo existente si hay uno
		if (sessionCheckInterval) {
			clearInterval(sessionCheckInterval);
		}

		// Verificar inmediatamente
		checkSessionExpiration();

		// Configurar verificación periódica (cada 5 minutos)
		if (session) {
			sessionCheckInterval = window.setInterval(checkSessionExpiration, 300000);
		}
	}

	onMount(() => {
		// Configurar verificación de sesión
		setupSessionCheck();

		// Escuchar cambios en la sesión
		const { data: subscriptionData } = supabase.auth.onAuthStateChange((event, newSession) => {
			// Si cambia la sesión, invalidar para recargar datos
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');

				// Reconfigurar verificación de sesión con los nuevos datos
				setupSessionCheck();
			}

			// Si se cierra la sesión, redirigir a login
			if (event === 'SIGNED_OUT') {
				goto('/auth');
			}
		});

		return () => {
			// Limpiar suscripción y intervalo al desmontar
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
