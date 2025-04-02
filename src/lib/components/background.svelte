<script lang="ts">
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let width = $state(0);
	let height = $state(0);
	let mouseX = $state(0);
	let mouseY = $state(0);
	let animationId = $state<number | null>(null);

	// opacity and max opacity will use props
	const { opacity = 0.09, maxOpacity = 0.2 } = $props();

	// Configuraciones personalizables
	const GRID_SPACING = 25;
	const BASE_OPACITY = opacity;
	const MAX_OPACITY = maxOpacity;
	const SIGMA = 40;

	onMount(() => {
		setup();
		window.addEventListener('resize', handleResize);
		window.addEventListener('mousemove', handleMouseMove);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mousemove', handleMouseMove);
			if (animationId) cancelAnimationFrame(animationId);
		};
	});

	function setup() {
		if (!canvas) return;
		width = window.innerWidth;
		height = window.innerHeight;
		canvas.width = width;
		canvas.height = height;
		ctx = canvas.getContext('2d');
		if (animationId) cancelAnimationFrame(animationId);
		animate();
	}

	function handleResize() {
		setup();
	}

	function handleMouseMove(e: MouseEvent) {
		mouseX = e.clientX;
		mouseY = e.clientY;
	}

	function animate() {
		if (!ctx) return;

		ctx.clearRect(0, 0, width, height);
		// Líneas verticales
		for (let x = 0; x < width; x += GRID_SPACING) {
			const d = Math.abs(x - mouseX);
			const opacity =
				BASE_OPACITY + (MAX_OPACITY - BASE_OPACITY) * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, height);
			ctx.strokeStyle = `rgba(100, 220, 150, ${opacity})`;
			ctx.lineWidth = 1;
			ctx.stroke();
		}
		// Líneas horizontales
		for (let y = 0; y < height; y += GRID_SPACING) {
			const d = Math.abs(y - mouseY);
			const opacity =
				BASE_OPACITY + (MAX_OPACITY - BASE_OPACITY) * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.strokeStyle = `rgba(100, 220, 150, ${opacity})`;
			ctx.lineWidth = 1;
			ctx.stroke();
		}

		animationId = requestAnimationFrame(animate);
	}
</script>

<canvas bind:this={canvas} class="absolute inset-0 z-[-2] pointer-events-none" aria-hidden="true"
></canvas>
