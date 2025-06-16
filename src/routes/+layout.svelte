<script lang="ts">
	let { data, children } = $props();
	import '../style.css';
	import '$lib/styles/utils.css';
	import Toast from '$lib/components/Toast.svelte';

	// Data from server load
	let { user, session } = $derived(data);
</script>

<Toast />

{@render children()}
