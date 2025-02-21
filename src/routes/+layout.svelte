<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	let { data, children } = $props();
	import '../style.css';

	// Extraer datos derivados
	let { session, supabase } = $derived(data);

	onMount(() => {
		// Escuchar cambios de estado de autenticación
		const { data: subscriptionData } = supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		// Limpiar la suscripción al desmontar el componente
		return () => subscriptionData.subscription.unsubscribe();
	});
</script>

{@render children()}
