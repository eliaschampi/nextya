<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	let { data, children } = $props();
	import '../style.css';
	import Toast from '$lib/components/Toast.svelte';

	let { session, supabase } = $derived(data);

	onMount(() => {
		const { data: subscriptionData } = supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => subscriptionData.subscription.unsubscribe();
	});
</script>

<Toast />
{@render children()}
