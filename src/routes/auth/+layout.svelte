<script lang="ts">
	import Background from '$lib/components/background.svelte';
	const { children } = $props();
</script>

<main class="min-h-screen w-full relative overflow-hidden bg-base-200">
	<Background opacity={0.2} maxOpacity={0.4} />
	<div class="relative z-10 w-full grid place-content-center min-h-screen">
		<div class="w-full max-w-md px-4">
			{@render children()}
		</div>
	</div>
</main>
