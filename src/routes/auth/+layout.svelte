<script lang="ts">
	let { children } = $props();
	import { onMount } from 'svelte';

	// Fluid particle type definition
	type FluidParticle = {
		id: string;
		x: number;
		y: number;
		size: number;
		vx: number;
		vy: number;
		opacity: number;
		color: string;
	};

	let particles = $state<FluidParticle[]>([]);
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D | null;
	let width: number;
	let height: number;
	let mouseX = $state(0);
	let mouseY = $state(0);
	let animationId = $state<number | null>(null);

	// Configuration for fluid particles - reduced speed
	const PARTICLE_COUNT = 150;
	const MOUSE_INFLUENCE = 100;
	const FLOW_SPEED = 0.1; // Reduced from 0.3
	const FLOW_DIRECTION = { x: 0.15, y: 0.05 }; // Reduced from 0.3, 0.1

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

		// Initialize particles
		initializeParticles();

		// Start animation loop
		if (animationId) cancelAnimationFrame(animationId);
		animate();
	}

	function initializeParticles() {
		particles = [];
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({
				id: crypto.randomUUID(),
				x: Math.random() * width,
				y: Math.random() * height,
				size: Math.random() * 4 + 2,
				vx: (Math.random() - 0.5) * 0.2,
				vy: (Math.random() - 0.5) * 0.2,
				opacity: Math.random() * 0.5 + 0.1,
				color: 'rgba(100, 220, 150, 0.4)'
			});
		}
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

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Update and draw particles
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];

			// Apply base flow (slower)
			p.vx += FLOW_DIRECTION.x * FLOW_SPEED;
			p.vy += FLOW_DIRECTION.y * FLOW_SPEED;

			// Apply mouse influence (gentler)
			const dx = mouseX - p.x;
			const dy = mouseY - p.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance < MOUSE_INFLUENCE) {
				const force = (MOUSE_INFLUENCE - distance) / MOUSE_INFLUENCE;
				p.vx += (dx / distance) * force * 0.1; // Reduced from 0.2
				p.vy += (dy / distance) * force * 0.1; // Reduced from 0.2
			}

			// Apply stronger friction to slow down particles
			p.vx *= 0.95;
			p.vy *= 0.95;

			// Update position
			p.x += p.vx;
			p.y += p.vy;

			// Wrap around edges
			if (p.x < 0) p.x = width;
			if (p.x > width) p.x = 0;
			if (p.y < 0) p.y = height;
			if (p.y > height) p.y = 0;

			// Draw particle with primary color
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
			ctx.fillStyle = `color-mix(in srgb, ${p.color} ${p.opacity * 100}%, transparent)`;
			ctx.fill();

			// Add subtle glow effect with primary color
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
			ctx.fillStyle = `color-mix(in srgb, ${p.color} ${p.opacity * 20}%, transparent)`;
			ctx.fill();
		}

		animationId = requestAnimationFrame(animate);
	}
</script>

<main class="min-h-screen w-full relative overflow-hidden bg-base-200">
	<!-- Grid background -->
	<div class="grid-background" aria-hidden="true"></div>

	<!-- Canvas for fluid particles -->
	<canvas bind:this={canvas} class="absolute inset-0 z-1 pointer-events-none" aria-hidden="true"
	></canvas>

	<!-- Content container -->
	<div class="relative z-10 w-full grid place-content-center min-h-screen">
		<div class="w-full max-w-md px-4">
			{@render children()}
		</div>
	</div>
</main>

<style>
	.grid-background {
		position: absolute;
		inset: 0;
		background-size: 1rem 1rem;
		background-image:
			linear-gradient(
				to right,
				color-mix(in srgb, currentColor 5%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				to bottom,
				color-mix(in srgb, currentColor 5%, transparent) 1px,
				transparent 1px
			);
		pointer-events: none;
		z-index: 0;
	}
</style>
