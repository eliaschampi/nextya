import { writable } from 'svelte/store';
import type { ToastState, ToastType } from '../../app';

let toastId = 0;
export const toasts = writable<ToastState[]>([]);

// Mapa para almacenar los timeouts de cada toast
const timeouts: Record<number, ReturnType<typeof setTimeout>> = {};

/**
 * Muestra un toast nuevo y programa su remoción en 5 segundos.
 */
export function showToast(title: string, type: ToastType) {
	const id = ++toastId;
	const newToast: ToastState = { id, title, type };
	toasts.update((prev) => [...prev, newToast]);

	// Limpia timeout previo (por si acaso)
	if (timeouts[id]) clearTimeout(timeouts[id]);
	timeouts[id] = setTimeout(() => {
		removeToast(id);
	}, 5000);
}

/**
 * Remueve el toast con el id dado y limpia su timeout.
 */
export function removeToast(id: number) {
	if (timeouts[id]) {
		clearTimeout(timeouts[id]);
		delete timeouts[id];
	}
	toasts.update((prev) => prev.filter((toast) => toast.id !== id));
}
