<!-- PageHeader.svelte -->
<script lang="ts">
	let { children, title, description } = $props();
</script>

<div class="header-container relative w-full flex justify-center items-center py-4 pattern">
	<div class="card w-full max-w-lg">
		<div class="card-body text-center space-y-1">
			<h1 class="text-2xl font-bold">{title}</h1>
			<p class="text-description">{description}</p>
			<div>
				{@render children?.()}
			</div>
		</div>
	</div>
</div>
<div class="divider"></div>

<style>
	/* app.css */
	.text-description {
		color: color-mix(in oklch, var(--color-base-content), transparent 25%);
	}
	.header-container.pattern::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background:
			radial-gradient(
				circle at 20% 30%,
				color-mix(in oklch, var(--color-primary), transparent 70%),
				transparent 40%
			),
			radial-gradient(
				circle at 80% 70%,
				color-mix(in oklch, var(--color-accent), transparent 70%),
				transparent 40%
			);
		filter: blur(30px);
	}
</style>
