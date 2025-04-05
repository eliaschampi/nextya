import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
        // Indica a Vite que no externalice/procese este módulo nativo
        noExternal: ['@u4/opencv4nodejs'],
    },
    // Opcional: A veces también ayuda excluirlo de optimizeDeps
    optimizeDeps: {
         exclude: ['@u4/opencv4nodejs'],
    }
});
